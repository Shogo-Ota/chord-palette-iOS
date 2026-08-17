import AVFoundation

/// Sample-accurate offline renderer for video export.
///
/// It consumes the same flattened Final MIDI schedule as realtime playback and
/// drives the same AVAudioUnitSampler/SoundFont semantics. It knows nothing about
/// chords or accompaniment styles; NoteOn, NoteOff and CC messages are authoritative.
final class OfflineMidiRenderer {
  private struct FramedEvent {
    let frame: Int64
    let sourceIndex: Int
    let event: ScheduledMidiEvent
  }

  private static let sampleRate = 48_000.0
  private static let maximumFrameCount: AVAudioFrameCount = 4096
  private static let chordHeadroomDb: Float = -6
  private static let drumHeadroomDb: Float = -8

  func render(
    bpm: Double,
    durationSec: Double,
    events: [ScheduledMidiEvent],
    soundFontURL: URL,
    gmProgram: UInt8,
    hasDrums: Bool
  ) throws -> (url: URL, sampleRate: Double) {
    guard bpm > 0, durationSec > 0, !events.isEmpty else {
      throw error("Invalid offline MIDI plan")
    }

    let engine = AVAudioEngine()
    let chordSampler = AVAudioUnitSampler()
    let drumSampler = AVAudioUnitSampler()
    let chordMixer = AVAudioMixerNode()
    let drumMixer = AVAudioMixerNode()
    let limiter = makeLimiter()

    guard
      let format = AVAudioFormat(
        standardFormatWithSampleRate: Self.sampleRate,
        channels: 2
      )
    else {
      throw error("Could not create offline render format")
    }

    engine.attach(chordSampler)
    engine.attach(drumSampler)
    engine.attach(chordMixer)
    engine.attach(drumMixer)
    engine.attach(limiter)
    engine.connect(chordSampler, to: chordMixer, format: format)
    engine.connect(drumSampler, to: drumMixer, format: format)
    engine.connect(chordMixer, to: engine.mainMixerNode, format: format)
    engine.connect(drumMixer, to: engine.mainMixerNode, format: format)
    engine.connect(engine.mainMixerNode, to: limiter, format: format)
    engine.connect(limiter, to: engine.outputNode, format: format)

    chordSampler.masterGain = Self.chordHeadroomDb
    drumSampler.masterGain = Self.drumHeadroomDb
    chordMixer.outputVolume = 0.85
    drumMixer.outputVolume = 0.8
    engine.mainMixerNode.outputVolume = 0.9

    try engine.enableManualRenderingMode(
      .offline,
      format: format,
      maximumFrameCount: Self.maximumFrameCount
    )
    try chordSampler.loadSoundBankInstrument(
      at: soundFontURL,
      program: gmProgram,
      bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB),
      bankLSB: UInt8(kAUSampler_DefaultBankLSB)
    )
    if hasDrums {
      try drumSampler.loadSoundBankInstrument(
        at: soundFontURL,
        program: 0,
        bankMSB: UInt8(kAUSampler_DefaultPercussionBankMSB),
        bankLSB: UInt8(kAUSampler_DefaultBankLSB)
      )
    }
    engine.prepare()
    try engine.start()
    defer {
      allNotesOff(chordSampler)
      allNotesOff(drumSampler)
      engine.stop()
    }

    guard
      let buffer = AVAudioPCMBuffer(
        pcmFormat: engine.manualRenderingFormat,
        frameCapacity: Self.maximumFrameCount
      )
    else {
      throw error("Could not allocate offline render buffer")
    }

    // SoundFont regions are paged lazily. The realtime path gets a count-in in which
    // to settle; prime the exact pitches here, then force them silent before capture.
    try prime(
      engine: engine,
      buffer: buffer,
      chordSampler: chordSampler,
      drumSampler: drumSampler,
      events: events
    )

    let outURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("chord-export-\(UUID().uuidString).m4a")
    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: Self.sampleRate,
      AVNumberOfChannelsKey: 2,
    ]
    let file = try AVAudioFile(forWriting: outURL, settings: settings)

    let secondsPerBeat = 60.0 / bpm
    var scheduled: [FramedEvent] = []
    scheduled.reserveCapacity(events.count)
    for (index, event) in events.enumerated() {
      let eventSeconds = event.beat * secondsPerBeat
      let roundedFrame = Int64((eventSeconds * Self.sampleRate).rounded())
      let clampedFrame = roundedFrame < 0 ? Int64(0) : roundedFrame
      scheduled.append(
        FramedEvent(
          frame: clampedFrame,
          sourceIndex: index,
          event: event
        )
      )
    }
    scheduled.sort { left, right in
      if left.frame != right.frame {
        return left.frame < right.frame
      }
      return left.sourceIndex < right.sourceIndex
    }
    let roundedDurationFrames = Int64((durationSec * Self.sampleRate).rounded())
    let totalFrames = roundedDurationFrames > 0 ? roundedDurationFrames : Int64(1)
    let samePitchGate = SamePitchNoteGate()
    var eventIndex = 0
    var frame = Int64(0)

    while frame < totalFrames {
      while eventIndex < scheduled.count, scheduled[eventIndex].frame <= frame {
        send(
          scheduled[eventIndex].event,
          chordSampler: chordSampler,
          drumSampler: drumSampler,
          samePitchGate: samePitchGate
        )
        eventIndex += 1
      }

      let nextEventFrame =
        eventIndex < scheduled.count ? scheduled[eventIndex].frame : totalFrames
      let chunkEnd = frame + Int64(Self.maximumFrameCount)
      let nextBoundary = nextEventFrame > frame ? nextEventFrame : frame + 1
      let eventOrChunkEnd = min(chunkEnd, nextBoundary)
      let boundary = min(totalFrames, eventOrChunkEnd)
      let count = AVAudioFrameCount(boundary - frame)
      try renderBlock(engine: engine, buffer: buffer, frameCount: count)
      try file.write(from: buffer)
      frame = boundary
    }

    return (outURL, Self.sampleRate)
  }

  private func prime(
    engine: AVAudioEngine,
    buffer: AVAudioPCMBuffer,
    chordSampler: AVAudioUnitSampler,
    drumSampler: AVAudioUnitSampler,
    events: [ScheduledMidiEvent]
  ) throws {
    try renderBlock(
      engine: engine,
      buffer: buffer,
      frameCount: Self.maximumFrameCount
    )

    let chordNotes = Array(
      Set(events.filter { $0.kind == "on" && !$0.drum }.map(\.a))
    ).sorted()
    try primeNotes(
      chordNotes,
      sampler: chordSampler,
      channel: 0,
      engine: engine,
      buffer: buffer
    )
    let drumNotes = Array(
      Set(events.filter { $0.kind == "on" && $0.drum }.map(\.a))
    ).sorted()
    try primeNotes(
      drumNotes,
      sampler: drumSampler,
      channel: 9,
      engine: engine,
      buffer: buffer
    )
  }

  private func primeNotes(
    _ notes: [UInt8],
    sampler: AVAudioUnitSampler,
    channel: UInt8,
    engine: AVAudioEngine,
    buffer: AVAudioPCMBuffer
  ) throws {
    let batchSize = 8
    for start in stride(from: 0, to: notes.count, by: batchSize) {
      let end = min(notes.count, start + batchSize)
      for note in notes[start..<end] {
        sampler.startNote(note, withVelocity: 1, onChannel: channel)
      }
      try renderBlock(
        engine: engine,
        buffer: buffer,
        frameCount: Self.maximumFrameCount
      )
      allNotesOff(sampler)
      try renderBlock(
        engine: engine,
        buffer: buffer,
        frameCount: Self.maximumFrameCount
      )
    }
  }

  private func send(
    _ event: ScheduledMidiEvent,
    chordSampler: AVAudioUnitSampler,
    drumSampler: AVAudioUnitSampler,
    samePitchGate: SamePitchNoteGate
  ) {
    let sampler = event.drum ? drumSampler : chordSampler
    switch event.kind {
    case "on":
      if !event.drum {
        samePitchGate.noteOn(channel: event.channel, note: event.a)
      }
      sampler.startNote(
        event.a,
        withVelocity: max(1, event.b),
        onChannel: event.channel
      )
    case "off":
      if !event.drum,
        !samePitchGate.shouldSendNoteOff(
          channel: event.channel,
          note: event.a
        )
      {
        return
      }
      sampler.stopNote(event.a, onChannel: event.channel)
    case "cc":
      sampler.sendController(
        event.a,
        withValue: event.b,
        onChannel: event.channel
      )
    default:
      break
    }
  }

  private func renderBlock(
    engine: AVAudioEngine,
    buffer: AVAudioPCMBuffer,
    frameCount: AVAudioFrameCount
  ) throws {
    let status = try engine.renderOffline(frameCount, to: buffer)
    switch status {
    case .success:
      return
    case .insufficientDataFromInputNode:
      throw error("Offline renderer received insufficient input")
    case .cannotDoInCurrentContext:
      throw error("Offline renderer cannot render in current context")
    case .error:
      throw error("Offline renderer failed")
    @unknown default:
      throw error("Offline renderer returned an unknown status")
    }
  }

  private func allNotesOff(_ sampler: AVAudioUnitSampler) {
    for channel in UInt8(0)...UInt8(15) {
      sampler.sendController(64, withValue: 0, onChannel: channel)
      sampler.sendController(123, withValue: 0, onChannel: channel)
      sampler.sendController(120, withValue: 0, onChannel: channel)
    }
  }

  private func makeLimiter() -> AVAudioUnitEffect {
    AVAudioUnitEffect(
      audioComponentDescription: AudioComponentDescription(
        componentType: kAudioUnitType_Effect,
        componentSubType: kAudioUnitSubType_PeakLimiter,
        componentManufacturer: kAudioUnitManufacturer_Apple,
        componentFlags: 0,
        componentFlagsMask: 0
      )
    )
  }

  private func error(_ message: String) -> NSError {
    NSError(
      domain: "ChordAudio.OfflineMidiRenderer",
      code: -1,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
  }
}

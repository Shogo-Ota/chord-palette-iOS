import AVFoundation
import os

/// One MIDI message to send the live sampler, timed in beats.
struct ScheduledMidiEvent {
  let beat: Double
  let kind: String
  let channel: UInt8
  let a: UInt8
  let b: UInt8
  let drum: Bool
}

/// Playback v2 — the sampler plays; nothing is pre-rendered.
///
/// v1 records each MIDI note once and reads the buffer back. This engine loads
/// the SoundFont into a live `AVAudioUnitSampler` and sends NoteOn / NoteOff / CC64
/// on a dedicated native queue. Timing is computed from bpm + beat once, up front;
/// JS never schedules a note.
///
/// `AVAudioSequencer` is intentionally not used. Creating it against an already
/// running `AVAudioEngine` (the v1 graph is started in `prepare`) produced a
/// successful `start()` and then silence on device.
///
/// Knows nothing about patterns, chords, or teacher takes. A new Human MIDI
/// Template plays here as long as the snapshot is correct.
final class RealtimeSamplerEngine {
  private let log = OSLog(subsystem: "app.chord-palette.audio", category: "RealtimeSampler")

  private let chordSampler = AVAudioUnitSampler()
  private let drumSampler = AVAudioUnitSampler()
  private let samePitchGate = SamePitchNoteGate()

  private static let chordHeadroomDb: Float = -6
  private static let drumHeadroomDb: Float = -8

  private unowned let engine: AVAudioEngine
  private var attached = false

  private var loadedInstrument: String?
  private var loadedProgram: UInt8?
  private var drumBankLoaded = false

  private var loopLengthBeats: Double = 0
  private var looping = false
  private var playBpm: Double = 90
  private var playStartBeat: Double = 0
  private var hostStartNanos: UInt64 = 0
  private var playingFlag = false
  private var playGeneration: UInt64 = 0
  private var lastEvents: [ScheduledMidiEvent] = []
  private var pausedBeat: Double = 0

  private let midiQueue = DispatchQueue(
    label: "app.chord-palette.realtime-midi",
    qos: .userInteractive
  )
  private var workItems: [DispatchWorkItem] = []

  private(set) var lastError: String?
  private(set) var lastLoadedSoundFontPath: String?
  private(set) var planSignature: String?
  private(set) var scheduledEventCount = 0
  private(set) var sentNoteOnCount = 0
  private(set) var sentNoteOffCount = 0
  private(set) var sentCc64Count = 0
  private(set) var sentPitchMin = 0
  private(set) var sentPitchMax = 0

  init(engine: AVAudioEngine) {
    self.engine = engine
  }

  func attach(chordBus: AVAudioMixerNode, drumBus: AVAudioMixerNode, format: AVAudioFormat) {
    guard !attached else { return }
    chordSampler.masterGain = Self.chordHeadroomDb
    drumSampler.masterGain = Self.drumHeadroomDb
    engine.attach(chordSampler)
    engine.attach(drumSampler)
    engine.connect(chordSampler, to: chordBus, format: format)
    engine.connect(drumSampler, to: drumBus, format: format)
    attached = true
  }

  var isAttached: Bool { attached }

  @discardableResult
  func setInstrument(_ instrumentId: String, program: UInt8, soundFontURL: URL) -> Bool {
    if loadedInstrument == instrumentId, loadedProgram == program { return true }
    do {
      try chordSampler.loadSoundBankInstrument(
        at: soundFontURL,
        program: program,
        bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB),
        bankLSB: UInt8(kAUSampler_DefaultBankLSB)
      )
      loadedInstrument = instrumentId
      loadedProgram = program
      lastLoadedSoundFontPath = soundFontURL.path
      lastError = nil
      return true
    } catch {
      lastError =
        "instrument load failed: id=\(instrumentId) program=\(program) "
        + "path=\(soundFontURL.path) error=\(String(describing: error))"
      os_log("v2 instrument load failed: %{public}@", log: log, type: .error, lastError ?? "")
      return false
    }
  }

  @discardableResult
  func loadDrumBank(soundFontURL: URL) -> Bool {
    if drumBankLoaded { return true }
    do {
      try drumSampler.loadSoundBankInstrument(
        at: soundFontURL,
        program: 0,
        bankMSB: UInt8(kAUSampler_DefaultPercussionBankMSB),
        bankLSB: UInt8(kAUSampler_DefaultBankLSB)
      )
      drumBankLoaded = true
      return true
    } catch {
      lastError =
        "drum bank load failed: path=\(soundFontURL.path) error=\(String(describing: error))"
      os_log("v2 drum bank load failed: %{public}@", log: log, type: .error, lastError ?? "")
      return false
    }
  }

  /// Replace the current take with `events`. Returns false if there is nothing to play
  /// or the instrument is missing — the caller must not pretend transport started.
  @discardableResult
  func play(
    events: [ScheduledMidiEvent],
    bpm: Double,
    totalBeats: Double,
    loop: Bool,
    startBeat: Double,
    signature: String?
  ) -> Bool {
    cancelScheduled()
    allNotesOff()
    samePitchGate.reset()

    guard attached else {
      lastError = "play called before samplers were attached"
      return false
    }
    guard loadedProgram != nil else {
      lastError = "play called before an instrument was loaded"
      return false
    }
    guard !events.isEmpty else {
      lastError = "play called with 0 MIDI events"
      return false
    }
    guard bpm > 0, totalBeats > 0 else {
      lastError = "play called with bpm=\(bpm) totalBeats=\(totalBeats)"
      return false
    }

    playGeneration += 1
    let gen = playGeneration
    lastEvents = events
    playBpm = bpm
    playStartBeat = max(0, startBeat)
    loopLengthBeats = totalBeats
    looping = loop && totalBeats > 0
    planSignature = signature
    scheduledEventCount = events.count
    let chordOns = events.filter { $0.kind == "on" && !$0.drum }
    sentNoteOnCount = chordOns.count
    sentNoteOffCount = events.filter { $0.kind == "off" && !$0.drum }.count
    sentCc64Count = events.filter { $0.kind == "cc" && $0.a == 64 }.count
    sentPitchMin = chordOns.map { Int($0.a) }.min() ?? 0
    sentPitchMax = chordOns.map { Int($0.a) }.max() ?? 0
    hostStartNanos = DispatchTime.now().uptimeNanoseconds
    playingFlag = true
    lastError = nil

    // Two loops are armed up front so the second loop's first notes are not late.
    // Each time a loop boundary arrives, the loop after next is scheduled.
    scheduleEvents(events, loopIndex: 0, generation: gen)
    if looping {
      scheduleEvents(events, loopIndex: 1, generation: gen)
      armNextLoop(events: events, justScheduled: 1, generation: gen)
    }
    return true
  }

  func pause() {
    pausedBeat = currentBeat
    playingFlag = false
    cancelScheduled()
    allNotesOff()
  }

  @discardableResult
  func resume() -> Bool {
    guard !lastEvents.isEmpty else {
      lastError = "resume called with no loaded plan"
      return false
    }
    return play(
      events: lastEvents,
      bpm: playBpm,
      totalBeats: loopLengthBeats,
      loop: looping,
      startBeat: pausedBeat,
      signature: planSignature
    )
  }

  func stop() {
    playGeneration += 1
    playingFlag = false
    cancelScheduled()
    allNotesOff()
    hostStartNanos = 0
  }

  var isPlaying: Bool { playingFlag }
  var hasPlan: Bool { scheduledEventCount > 0 }

  var currentBeat: Double {
    guard playingFlag, hostStartNanos > 0 else { return playStartBeat }
    return foldIntoLoop(playStartBeat + elapsedBeats())
  }

  var rawBeat: Double {
    guard playingFlag, hostStartNanos > 0 else { return playStartBeat }
    return max(0, playStartBeat + elapsedBeats())
  }

  var reachedEnd: Bool {
    guard playingFlag, !looping, loopLengthBeats > 0 else { return false }
    return rawBeat >= loopLengthBeats
  }

  func previewChord(notes: [Int], velocity: Int, durationSec: Double) {
    let vel = UInt8(max(1, min(127, velocity)))
    let playable = notes.filter { $0 >= 0 && $0 <= 127 }.map { UInt8($0) }
    for note in playable {
      chordSampler.startNote(note, withVelocity: vel, onChannel: 0)
    }
    let deadline = DispatchTime.now() + max(0.05, durationSec)
    DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: deadline) { [weak self] in
      guard let self else { return }
      for note in playable {
        self.chordSampler.stopNote(note, onChannel: 0)
      }
    }
  }

  func allNotesOff() {
    // Clear logical key lifetimes before forcing the samplers silent. Keep the
    // previous take's diagnostics available until the next play starts.
    samePitchGate.reset(resetDiagnostics: false)
    for channel in UInt8(0)...UInt8(15) {
      for sampler in [chordSampler, drumSampler] {
        sampler.sendController(64, withValue: 0, onChannel: channel)
        sampler.sendController(123, withValue: 0, onChannel: channel)
        sampler.sendController(120, withValue: 0, onChannel: channel)
      }
    }
  }

  func teardown() {
    stop()
    samePitchGate.reset()
    planSignature = nil
    scheduledEventCount = 0
    sentNoteOnCount = 0
    sentNoteOffCount = 0
    sentCc64Count = 0
    sentPitchMin = 0
    sentPitchMax = 0
  }

  func diagnostics() -> [String: Any] {
    let gate = samePitchGate.diagnostics()
    var out: [String: Any] = [
      "attached": attached,
      "planLoaded": scheduledEventCount > 0,
      "isPlaying": isPlaying,
      "looping": looping,
      "loopLengthBeats": loopLengthBeats,
      "currentBeat": currentBeat,
      "drumBankLoaded": drumBankLoaded,
      "scheduledEventCount": scheduledEventCount,
      "scheduler": "native-midi-queue",
      "sentNoteOnCount": sentNoteOnCount,
      "sentNoteOffCount": sentNoteOffCount,
      "sentCc64Count": sentCc64Count,
      "sentPitchMin": sentPitchMin,
      "sentPitchMax": sentPitchMax,
      "samePitchActiveKeys": gate.activeKeys,
      "samePitchSuppressedNoteOffs": gate.suppressedNoteOffs,
      "samePitchPeakDepth": gate.peakDepth,
    ]
    if let instrument = loadedInstrument { out["instrument"] = instrument }
    if let program = loadedProgram { out["program"] = Int(program) }
    if let path = lastLoadedSoundFontPath { out["soundFontPath"] = path }
    if let signature = planSignature { out["planSignature"] = signature }
    if let error = lastError { out["lastError"] = error }
    return out
  }

  // MARK: - Schedule

  private func scheduleEvents(
    _ events: [ScheduledMidiEvent],
    loopIndex: Int,
    generation: UInt64
  ) {
    let origin = playStartBeat
    let secondsPerBeat = 60.0 / playBpm
    for ev in events {
      let absBeat = ev.beat + Double(loopIndex) * loopLengthBeats
      let rel = absBeat - origin
      if rel < -0.000_001 { continue }
      let item = DispatchWorkItem { [weak self] in
        guard let self, self.playGeneration == generation, self.playingFlag else { return }
        self.send(ev)
      }
      workItems.append(item)
      midiQueue.asyncAfter(
        deadline: DispatchTime(uptimeNanoseconds: hostStartNanos)
          + .microseconds(Int(rel * secondsPerBeat * 1_000_000)),
        execute: item
      )
    }
  }

  private func armNextLoop(events: [ScheduledMidiEvent], justScheduled: Int, generation: UInt64) {
    let origin = playStartBeat
    let secondsPerBeat = 60.0 / playBpm
    let boundary = Double(justScheduled) * loopLengthBeats - origin
    let arm = DispatchWorkItem { [weak self] in
      guard let self, self.playGeneration == generation, self.playingFlag else { return }
      let next = justScheduled + 1
      self.scheduleEvents(events, loopIndex: next, generation: generation)
      self.armNextLoop(events: events, justScheduled: next, generation: generation)
    }
    workItems.append(arm)
    midiQueue.asyncAfter(
      deadline: DispatchTime(uptimeNanoseconds: hostStartNanos)
        + .microseconds(Int(max(0, boundary) * secondsPerBeat * 1_000_000)),
      execute: arm
    )
  }

  private func send(_ ev: ScheduledMidiEvent) {
    let sampler = ev.drum ? drumSampler : chordSampler
    switch ev.kind {
    case "on":
      // MIDI legal range only (0–127 at the bridge). Do not fold 85–90 to 84.
      if !ev.drum {
        samePitchGate.noteOn(channel: ev.channel, note: ev.a)
      }
      sampler.startNote(ev.a, withVelocity: max(1, ev.b), onChannel: ev.channel)
    case "off":
      if !ev.drum,
        !samePitchGate.shouldSendNoteOff(channel: ev.channel, note: ev.a)
      {
        return
      }
      sampler.stopNote(ev.a, onChannel: ev.channel)
    case "cc":
      sampler.sendController(ev.a, withValue: ev.b, onChannel: ev.channel)
    default:
      break
    }
  }

  private func cancelScheduled() {
    for item in workItems { item.cancel() }
    workItems.removeAll(keepingCapacity: true)
  }

  private func elapsedBeats() -> Double {
    let now = DispatchTime.now().uptimeNanoseconds
    let elapsedSec = Double(now &- hostStartNanos) / 1_000_000_000.0
    return elapsedSec * playBpm / 60.0
  }

  private func foldIntoLoop(_ beat: Double) -> Double {
    let b = max(0, beat)
    guard looping, loopLengthBeats > 0 else { return b }
    let folded = b.truncatingRemainder(dividingBy: loopLengthBeats)
    return folded < 0 ? folded + loopLengthBeats : folded
  }
}

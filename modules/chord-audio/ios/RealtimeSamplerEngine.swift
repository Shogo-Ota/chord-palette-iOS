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
/// from an Audio Unit render observer. Timing is computed from bpm + beat once,
/// then submitted at an exact frame offset inside each audio buffer; JS and OS
/// dispatch timers never schedule a note.
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
  private let chordReverb = AVAudioUnitReverb()
  private let samePitchGate = SamePitchNoteGate()
  private let renderClock = SampleAccurateMidiClock()
  private var chordScheduler: SampleAccurateMidiScheduler?
  private var drumScheduler: SampleAccurateMidiScheduler?

  private static let chordHeadroomDb: Float = -6
  private static let drumHeadroomDb: Float = -8

  private unowned let engine: AVAudioEngine
  private var attached = false

  private var loadedInstrument: String?
  private var loadedProgram: UInt8?
  private var drumBankLoaded = false
  private var reverbPreset = "off"
  private var reverbWetDryMix: Float = 0

  private var loopLengthBeats: Double = 0
  private var looping = false
  private var playBpm: Double = 90
  private var playStartBeat: Double = 0
  private var hostStartNanos: UInt64 = 0
  private var playingFlag = false
  private var lastEvents: [ScheduledMidiEvent] = []
  private var pausedBeat: Double = 0
  private var firstNoteOnSent = false
  /// Chord-card audition ownership. A generation invalidates delayed NoteOffs
  /// from the previous audition before shared tones can cut the new chord.
  private let previewLock = NSLock()
  private var previewGeneration: UInt64 = 0
  private var activePreviewNotes: [UInt8] = []

  private let diagnosticsQueue = DispatchQueue(
    label: "app.chord-palette.realtime-diagnostics",
    qos: .utility
  )

  private(set) var lastError: String?
  private(set) var lastLoadedSoundFontPath: String?
  private(set) var planSignature: String?
  private(set) var scheduledEventCount = 0
  private(set) var sentNoteOnCount = 0
  private(set) var sentNoteOffCount = 0
  private(set) var sentCc64Count = 0
  private(set) var sentPitchMin = 0
  private(set) var sentPitchMax = 0
  private(set) var restoredActiveVoiceCount = 0
  private(set) var restoredSustainedVoiceCount = 0
  private(set) var restoredControllerCount = 0
  /// Control-thread diagnostic hook. The callback must stay lightweight.
  var onFirstChordNoteOn: ((Int, Double) -> Void)?

  init(engine: AVAudioEngine) {
    self.engine = engine
  }

  func attach(chordBus: AVAudioMixerNode, drumBus: AVAudioMixerNode, format: AVAudioFormat) {
    guard !attached else { return }
    chordSampler.masterGain = Self.chordHeadroomDb
    drumSampler.masterGain = Self.drumHeadroomDb
    chordReverb.loadFactoryPreset(.smallRoom)
    chordReverb.wetDryMix = 0
    engine.attach(chordSampler)
    engine.attach(drumSampler)
    engine.attach(chordReverb)
    engine.connect(chordSampler, to: chordReverb, format: format)
    engine.connect(chordReverb, to: chordBus, format: format)
    engine.connect(drumSampler, to: drumBus, format: format)
    chordScheduler = SampleAccurateMidiScheduler(
      sampler: chordSampler,
      clock: renderClock,
      onScheduled: { [weak self] event in
        self?.didScheduleChordEvent(event)
      }
    )
    drumScheduler = SampleAccurateMidiScheduler(
      sampler: drumSampler,
      clock: renderClock
    )
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

  func isInstrumentLoaded(_ instrumentId: String, program: UInt8) -> Bool {
    return loadedInstrument == instrumentId && loadedProgram == program
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
    signature: String?,
    reverbPreset: String,
    reverbWetDryMix: Double
  ) -> Bool {
    stopSchedulers()
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

    lastEvents = events
    playBpm = bpm
    playStartBeat = max(0, startBeat)
    loopLengthBeats = totalBeats
    looping = loop && totalBeats > 0
    planSignature = signature
    setReverb(preset: reverbPreset, wetDryMix: reverbWetDryMix)
    scheduledEventCount = events.count
    let chordOns = events.filter { $0.kind == "on" && !$0.drum }
    sentNoteOnCount = chordOns.count
    sentNoteOffCount = events.filter { $0.kind == "off" && !$0.drum }.count
    sentCc64Count = events.filter { $0.kind == "cc" && $0.a == 64 }.count
    sentPitchMin = chordOns.map { Int($0.a) }.min() ?? 0
    sentPitchMax = chordOns.map { Int($0.a) }.max() ?? 0
    firstNoteOnSent = false
    let schedulableChordEvents = prepareChordEvents(events.filter { !$0.drum })
    hostStartNanos = DispatchTime.now().uptimeNanoseconds
    playingFlag = true
    lastError = nil
    restoreMidiState(events, at: foldIntoLoop(playStartBeat))

    renderClock.reset()
    let sampleRate = engine.outputNode.outputFormat(forBus: 0).sampleRate
    let chordReady =
      chordScheduler?.start(
        events: schedulableChordEvents,
        bpm: bpm,
        totalBeats: totalBeats,
        loop: looping,
        startBeat: playStartBeat,
        sampleRate: sampleRate
      ) ?? false
    let drumReady =
      drumScheduler?.start(
        events: events.filter(\.drum),
        bpm: bpm,
        totalBeats: totalBeats,
        loop: looping,
        startBeat: playStartBeat,
        sampleRate: sampleRate
      ) ?? false
    guard chordReady, drumReady else {
      playingFlag = false
      stopSchedulers()
      allNotesOff()
      lastError = "sample-accurate MIDI scheduling is unavailable"
      return false
    }
    return true
  }

  func pause() {
    pausedBeat = currentBeat
    playingFlag = false
    stopSchedulers()
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
      signature: planSignature,
      reverbPreset: reverbPreset,
      reverbWetDryMix: Double(reverbWetDryMix)
    )
  }

  func stop() {
    playingFlag = false
    stopSchedulers()
    allNotesOff()
    hostStartNanos = 0
  }

  var isPlaying: Bool { playingFlag }
  var hasPlan: Bool { scheduledEventCount > 0 }

  var currentBeat: Double {
    return foldIntoLoop(rawBeat)
  }

  var rawBeat: Double {
    guard playingFlag, hostStartNanos > 0 else { return playStartBeat }
    let fallback = max(0, playStartBeat + elapsedBeats())
    return chordScheduler?.currentRawBeat(fallback: fallback) ?? fallback
  }

  var reachedEnd: Bool {
    guard playingFlag, !looping, loopLengthBeats > 0 else { return false }
    return rawBeat >= loopLengthBeats
  }

  func previewChord(notes: [Int], velocity: Int, durationSec: Double) {
    let vel = UInt8(max(1, min(127, velocity)))
    let playable = notes.filter { $0 >= 0 && $0 <= 127 }.map { UInt8($0) }
    previewLock.lock()
    previewGeneration += 1
    let generation = previewGeneration
    for note in activePreviewNotes {
      chordSampler.stopNote(note, onChannel: 0)
    }
    activePreviewNotes = playable
    for note in activePreviewNotes {
      chordSampler.startNote(note, withVelocity: vel, onChannel: 0)
    }
    previewLock.unlock()

    let deadline = DispatchTime.now() + max(0.05, durationSec)
    DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: deadline) { [weak self] in
      guard let self else { return }
      self.previewLock.lock()
      guard self.previewGeneration == generation else {
        self.previewLock.unlock()
        return
      }
      for note in self.activePreviewNotes {
        self.chordSampler.stopNote(note, onChannel: 0)
      }
      self.activePreviewNotes = []
      self.previewLock.unlock()
    }
  }

  func allNotesOff() {
    // Clear logical key lifetimes before forcing the samplers silent. Keep the
    // previous take's diagnostics available until the next play starts.
    samePitchGate.reset(resetDiagnostics: false)
    previewLock.lock()
    previewGeneration += 1
    activePreviewNotes = []
    for channel in UInt8(0)...UInt8(15) {
      for sampler in [chordSampler, drumSampler] {
        sampler.sendController(64, withValue: 0, onChannel: channel)
        sampler.sendController(123, withValue: 0, onChannel: channel)
        sampler.sendController(120, withValue: 0, onChannel: channel)
      }
    }
    previewLock.unlock()
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
    restoredActiveVoiceCount = 0
    restoredSustainedVoiceCount = 0
    restoredControllerCount = 0
  }

  func diagnostics() -> [String: Any] {
    let chordSchedule = chordScheduler?.diagnostics()
    let drumSchedule = drumScheduler?.diagnostics()
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
      "scheduler": "audio-render-clock",
      "sampleClockAvailable": chordSchedule?.available ?? false,
      "sampleClockChordBuffers": chordSchedule?.renderedBufferCount ?? 0,
      "sampleClockDrumBuffers": drumSchedule?.renderedBufferCount ?? 0,
      "sampleClockChordEvents": chordSchedule?.scheduledEventCount ?? 0,
      "sampleClockDrumEvents": drumSchedule?.scheduledEventCount ?? 0,
      "sampleClockLateEvents":
        (chordSchedule?.lateEventCount ?? 0) + (drumSchedule?.lateEventCount ?? 0),
      "sampleClockMaximumLateFrames": max(
        chordSchedule?.maximumLateFrames ?? 0,
        drumSchedule?.maximumLateFrames ?? 0
      ),
      "reverbPreset": reverbPreset,
      "reverbWetDryMix": reverbWetDryMix,
      "sentNoteOnCount": sentNoteOnCount,
      "sentNoteOffCount": sentNoteOffCount,
      "sentCc64Count": sentCc64Count,
      "sentPitchMin": sentPitchMin,
      "sentPitchMax": sentPitchMax,
      "restoredActiveVoiceCount": restoredActiveVoiceCount,
      "restoredSustainedVoiceCount": restoredSustainedVoiceCount,
      "restoredControllerCount": restoredControllerCount,
      "firstChordNoteOnSent": firstNoteOnSent,
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

  private struct VoiceKey: Hashable {
    let channel: UInt8
    let note: UInt8
    let drum: Bool
  }

  private struct VoiceChannelKey: Hashable {
    let channel: UInt8
    let drum: Bool
  }

  private struct ControllerKey: Hashable {
    let channel: UInt8
    let controller: UInt8
    let drum: Bool
  }

  /**
   * Reconstruct the MIDI state that was already sounding at a non-zero start.
   *
   * pause()/interruption deliberately sends All Notes Off. Scheduling only future
   * events after that would lose every held chord tone and leave whichever sparse
   * mask attacks next (often one bass note). Replay active keys, pedal-held voices
   * and controller state before future events are armed.
   */
  private func restoreMidiState(_ events: [ScheduledMidiEvent], at positionBeat: Double) {
    restoredActiveVoiceCount = 0
    restoredSustainedVoiceCount = 0
    restoredControllerCount = 0
    guard positionBeat > 0.000_001 else { return }

    var active: [VoiceKey: [UInt8]] = [:]
    var sustained: [VoiceKey: [UInt8]] = [:]
    var pedalDown: [VoiceChannelKey: Bool] = [:]
    var controllers: [ControllerKey: UInt8] = [:]

    for ev in events where ev.beat < positionBeat - 0.000_001 {
      let voiceKey = VoiceKey(channel: ev.channel, note: ev.a, drum: ev.drum)
      let channelKey = VoiceChannelKey(channel: ev.channel, drum: ev.drum)
      switch ev.kind {
      case "on":
        active[voiceKey, default: []].append(max(1, ev.b))
      case "off":
        guard var velocities = active[voiceKey], !velocities.isEmpty else { continue }
        let velocity = velocities.removeFirst()
        if velocities.isEmpty {
          active.removeValue(forKey: voiceKey)
        } else {
          active[voiceKey] = velocities
        }
        if pedalDown[channelKey] == true {
          sustained[voiceKey, default: []].append(velocity)
        }
      case "cc":
        controllers[
          ControllerKey(channel: ev.channel, controller: ev.a, drum: ev.drum)
        ] = ev.b
        if ev.a == 64 {
          let down = ev.b >= 64
          pedalDown[channelKey] = down
          if !down {
            for key in Array(sustained.keys)
            where key.channel == ev.channel && key.drum == ev.drum {
              sustained.removeValue(forKey: key)
            }
          }
        }
      default:
        break
      }
    }

    // Controllers first so a reconstructed pedal-held voice can be keyed and
    // released into an already-down pedal exactly like the original timeline.
    for (key, value) in controllers {
      let sampler = key.drum ? drumSampler : chordSampler
      sampler.sendController(key.controller, withValue: value, onChannel: key.channel)
      restoredControllerCount += 1
    }
    for (key, velocities) in sustained {
      guard pedalDown[VoiceChannelKey(channel: key.channel, drum: key.drum)] == true else {
        continue
      }
      let sampler = key.drum ? drumSampler : chordSampler
      for velocity in velocities {
        sampler.startNote(key.note, withVelocity: velocity, onChannel: key.channel)
        sampler.stopNote(key.note, onChannel: key.channel)
        restoredSustainedVoiceCount += 1
      }
    }
    // Same-pitch NoteOff suppression is precomputed before the render clock starts,
    // so restoration never mutates a lock-backed gate on the audio thread.
    for (key, velocities) in active {
      let sampler = key.drum ? drumSampler : chordSampler
      for velocity in velocities {
        sampler.startNote(key.note, withVelocity: velocity, onChannel: key.channel)
        if !key.drum {
          recordFirstChordNote(pitch: key.note, beat: positionBeat)
        }
        restoredActiveVoiceCount += 1
      }
    }
  }

  /// Resolve overlapping lifetimes before playback so the render observer only
  /// performs bounded array reads and Audio Unit scheduling.
  private func prepareChordEvents(
    _ events: [ScheduledMidiEvent]
  ) -> [ScheduledMidiEvent] {
    samePitchGate.reset()
    var prepared: [ScheduledMidiEvent] = []
    prepared.reserveCapacity(events.count)
    for event in events {
      switch event.kind {
      case "on":
        samePitchGate.noteOn(channel: event.channel, note: event.a)
        prepared.append(event)
      case "off":
        if samePitchGate.shouldSendNoteOff(channel: event.channel, note: event.a) {
          prepared.append(event)
        }
      default:
        prepared.append(event)
      }
    }
    // Keep suppression/peak diagnostics, but playback itself starts with no
    // lock-backed active keys.
    samePitchGate.reset(resetDiagnostics: false)
    return prepared
  }

  private func didScheduleChordEvent(_ event: ScheduledMidiEvent) {
    guard event.kind == "on" else { return }
    recordFirstChordNote(pitch: event.a, beat: event.beat)
  }

  private func recordFirstChordNote(pitch: UInt8, beat: Double) {
    guard !firstNoteOnSent else { return }
    firstNoteOnSent = true
    let midiPitch = Int(pitch)
    diagnosticsQueue.async { [weak self] in
      self?.onFirstChordNoteOn?(midiPitch, beat)
    }
  }

  private func stopSchedulers() {
    chordScheduler?.stop()
    drumScheduler?.stop()
  }

  private func setReverb(preset: String, wetDryMix: Double) {
    let isSmallRoom = preset == "smallRoom"
    reverbPreset = isSmallRoom ? "smallRoom" : "off"
    reverbWetDryMix = isSmallRoom
      ? Float(max(0, min(100, wetDryMix)))
      : 0
    chordReverb.wetDryMix = reverbWetDryMix
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

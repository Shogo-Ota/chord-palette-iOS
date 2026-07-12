import AVFoundation
import os

/// Immutable snapshot of what to play. Swapped atomically under the lock so the
/// audio thread never reads a half-mutated plan.
final class PlanSnapshot {
  let bpm: Double
  let totalBeats: Double
  let loop: Bool
  let events: [NoteEventValue]

  init(bpm: Double, totalBeats: Double, loop: Bool, events: [NoteEventValue]) {
    self.bpm = bpm
    self.totalBeats = totalBeats
    self.loop = loop
    self.events = events
  }
}

struct NoteEventValue {
  let midiNotes: [Int]
  let startBeat: Double
  let lengthBeats: Double
  let velocity: Int
}

enum PlaybackState: String {
  case idle, preparing, ready, playing, paused, stopped, failed
}

/// Owns AVAudioSession + AVAudioEngine and drives synchronized chord/drum
/// playback. Chord and drum source nodes share ONE sample clock (each render's
/// `mSampleTime` against a common base), which is what keeps them in sync
/// (sprint-2.md §4.2). `onPosition` is UI-only and never feeds the audio clock.
final class AudioEngineController {
  private let engine = AVAudioEngine()
  private var mixer: Mixer?
  private let synthProvider = SynthInstrumentProvider()
  /// Active chord voice. Starts as the synth and is swapped for a sampled
  /// (SoundFont) provider once an instrument is loaded. Read/written under the lock.
  private var chordProvider: InstrumentProvider = SynthInstrumentProvider()
  private let drumProvider: DrumProvider = SynthDrumProvider()
  /// Cache of loaded sampled instruments, keyed by instrument id (avoids re-render).
  private var sampledCache: [String: SampledInstrumentProvider] = [:]
  private var currentInstrument: String = ""

  /// Instrument id → General MIDI program number.
  private static let programForInstrument: [String: UInt8] = [
    "piano": 0, // Acoustic Grand Piano
    "ePiano": 4, // Electric Piano 1
    "acousticGuitar": 25, // Acoustic Guitar (steel)
    "electricGuitar": 27, // Electric Guitar (clean)
    "strings": 48, // String Ensemble 1
  ]
  private var chordSource: AVAudioSourceNode?
  private var drumSource: AVAudioSourceNode?
  private var format: AVAudioFormat?
  private var sampleRate: Double = 44_100

  private var unfairLock = os_unfair_lock_s()
  private var plan: PlanSnapshot?
  private var isPlaying = false
  private var baseSampleTime: Double?
  private var pausedFrames: Double = 0
  private var currentFrame: Double = 0
  private var finished = false

  // Independent single-chord preview overlay (chord card tap).
  private var previewActive = false
  private var previewBase: Double?
  private var previewNotes: [Int] = []
  private var previewDurationSec: Double = 0
  private var previewVelocity: Int = 100

  private var prepared = false
  private var positionTimer: DispatchSourceTimer?

  var onStateChange: ((String) -> Void)?
  var onPosition: ((Int, Double, Int) -> Void)?

  private(set) var state: PlaybackState = .idle {
    didSet {
      guard oldValue != state else { return }
      let raw = state.rawValue
      DispatchQueue.main.async { [weak self] in self?.onStateChange?(raw) }
    }
  }

  // MARK: - Lifecycle

  func prepare() throws {
    if prepared {
      state = .ready
      return
    }
    state = .preparing
    do {
      try configureSession()
      buildEngine()
      registerObservers()
      try engine.start()
      prepared = true
      // Load the default instrument (piano). Falls back to the synth on failure,
      // so playback is never silent even if the SoundFont is missing.
      setInstrument("piano")
      state = .ready
    } catch {
      state = .failed
      throw error
    }
  }

  /// Locate the bundled General MIDI SoundFont across the possible bundles a
  /// CocoaPods static framework / resource bundle can end up in.
  private static func soundFontURL() -> URL? {
    let names = ["FluidR3_GM2-2"]
    let exts = ["SF2", "sf2"]
    var bundles: [Bundle] = [Bundle(for: AudioEngineController.self), Bundle.main]
    for base in [Bundle(for: AudioEngineController.self), Bundle.main] {
      if let url = base.url(forResource: "ChordAudioAssets", withExtension: "bundle"),
        let assets = Bundle(url: url) {
        bundles.append(assets)
      }
    }
    for bundle in bundles {
      for name in names {
        for ext in exts {
          if let url = bundle.url(forResource: name, withExtension: ext) { return url }
        }
      }
    }
    return nil
  }

  /// Swap the chord voice to `instrumentId`, loading + caching the sampled
  /// SoundFont program on first use. Heavy work (offline render) runs on the
  /// calling (non-audio) thread; the pointer swap is done under the lock.
  func setInstrument(_ instrumentId: String) {
    guard prepared, instrumentId != currentInstrument else { return }
    let program = Self.programForInstrument[instrumentId] ?? 0
    var provider: InstrumentProvider = synthProvider

    if let cached = sampledCache[instrumentId], cached.isLoaded {
      provider = cached
    } else if let url = Self.soundFontURL() {
      let sampled = SampledInstrumentProvider(sampleRate: sampleRate)
      if sampled.load(soundFontURL: url, program: program) {
        sampledCache[instrumentId] = sampled
        provider = sampled
      }
    }

    os_unfair_lock_lock(&unfairLock)
    chordProvider = provider
    currentInstrument = instrumentId
    os_unfair_lock_unlock(&unfairLock)
  }

  func teardown() {
    stopPositionTimer()
    if engine.isRunning { engine.stop() }
    NotificationCenter.default.removeObserver(self)
    try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    os_unfair_lock_lock(&unfairLock)
    isPlaying = false
    plan = nil
    baseSampleTime = nil
    pausedFrames = 0
    currentFrame = 0
    previewActive = false
    os_unfair_lock_unlock(&unfairLock)
    prepared = false
    state = .idle
  }

  private func configureSession() throws {
    let session = AVAudioSession.sharedInstance()
    // .playback → plays through the silent switch; no .mixWithOthers → we take
    // over audio focus for clean timing verification (sprint-2.md §4.1).
    try session.setCategory(.playback, mode: .default, options: [])
    try session.setActive(true)
    sampleRate = session.sampleRate > 0 ? session.sampleRate : 44_100
  }

  private func buildEngine() {
    let fmt = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
    format = fmt
    let mix = Mixer(engine: engine)
    mixer = mix

    let chord = AVAudioSourceNode(format: fmt) { [weak self] isSilence, timestamp, frameCount, abl in
      self?.renderChord(isSilence: isSilence, timestamp: timestamp, frameCount: frameCount, abl: abl) ?? noErr
    }
    let drum = AVAudioSourceNode(format: fmt) { [weak self] isSilence, timestamp, frameCount, abl in
      self?.renderDrum(isSilence: isSilence, timestamp: timestamp, frameCount: frameCount, abl: abl) ?? noErr
    }
    chordSource = chord
    drumSource = drum

    engine.attach(chord)
    engine.attach(drum)
    engine.connect(chord, to: mix.chordMixer, format: fmt)
    engine.connect(drum, to: mix.drumMixer, format: fmt)
    mix.connect(engine: engine, format: fmt)

    mix.setMasterVolume(0.9)
    mix.setChordVolume(0.85)
    mix.setDrumVolume(0.8)

    engine.prepare()
  }

  // MARK: - Transport

  func play(bpm: Double, totalBeats: Double, loop: Bool, events: [NoteEventValue], instrument: String) {
    // §3.1: play() is a fresh-from-top playback, never a resume. It is only valid
    // once the engine is prepared and from ready/playing/paused/stopped. From
    // idle/preparing/failed it is a no-op (no state change, no onStateChange).
    // Gate BEFORE taking the lock or building a snapshot.
    guard prepared, state == .ready || state == .playing || state == .paused || state == .stopped else {
      return
    }
    // Ensure the requested voice is loaded before playback (no-op if unchanged).
    setInstrument(instrument)
    let snapshot = PlanSnapshot(bpm: bpm, totalBeats: totalBeats, loop: loop, events: events)
    os_unfair_lock_lock(&unfairLock)
    plan = snapshot
    isPlaying = true
    baseSampleTime = nil
    pausedFrames = 0
    currentFrame = 0
    finished = false
    os_unfair_lock_unlock(&unfairLock)
    state = .playing
    startPositionTimer()
  }

  func pause() {
    os_unfair_lock_lock(&unfairLock)
    let wasPlaying = isPlaying
    if wasPlaying {
      isPlaying = false
      pausedFrames = currentFrame
      baseSampleTime = nil
    }
    os_unfair_lock_unlock(&unfairLock)
    if wasPlaying {
      stopPositionTimer()
      state = .paused
    }
  }

  func resume() {
    os_unfair_lock_lock(&unfairLock)
    let canResume = (state == .paused) && plan != nil
    if canResume {
      isPlaying = true
      baseSampleTime = nil // recomputed as sampleTime - pausedFrames on next render
    }
    os_unfair_lock_unlock(&unfairLock)
    if canResume {
      // Re-arm the engine in case the OS stopped it (interruption / config change)
      // while paused. Called on the caller (main) thread, never the audio thread,
      // and never inside the lock (engine.start() must not be held under the lock).
      if !engine.isRunning { try? engine.start() }
      state = .playing
      startPositionTimer()
    }
  }

  func stop() {
    os_unfair_lock_lock(&unfairLock)
    let wasActive = isPlaying || state == .paused
    isPlaying = false
    baseSampleTime = nil
    pausedFrames = 0
    currentFrame = 0
    finished = false
    os_unfair_lock_unlock(&unfairLock)
    stopPositionTimer()
    if wasActive { state = .stopped }
  }

  func previewChord(notes: [Int], velocity: Int, durationSec: Double, instrument: String) {
    setInstrument(instrument)
    os_unfair_lock_lock(&unfairLock)
    previewNotes = notes
    previewVelocity = velocity
    previewDurationSec = durationSec
    previewBase = nil
    previewActive = true
    os_unfair_lock_unlock(&unfairLock)
  }

  // MARK: - Volume

  func setMasterVolume(_ v: Float) { mixer?.setMasterVolume(v) }
  func setChordVolume(_ v: Float) { mixer?.setChordVolume(v) }
  func setDrumVolume(_ v: Float) { mixer?.setDrumVolume(v) }

  // MARK: - Render (audio thread)

  private func renderChord(
    isSilence: UnsafeMutablePointer<ObjCBool>,
    timestamp: UnsafePointer<AudioTimeStamp>,
    frameCount: AVAudioFrameCount,
    abl: UnsafeMutablePointer<AudioBufferList>
  ) -> OSStatus {
    let buffers = UnsafeMutableAudioBufferListPointer(abl)
    let sampleTime = timestamp.pointee.mSampleTime

    os_unfair_lock_lock(&unfairLock)
    let snap = plan
    let playing = isPlaying
    let sr = sampleRate
    let provider = chordProvider
    if playing && baseSampleTime == nil { baseSampleTime = sampleTime - pausedFrames }
    let base = baseSampleTime ?? sampleTime
    // preview base
    if previewActive && previewBase == nil { previewBase = sampleTime }
    let pvActive = previewActive
    let pvBase = previewBase ?? sampleTime
    let pvNotes = previewNotes
    let pvDur = previewDurationSec
    let pvVel = previewVelocity
    os_unfair_lock_unlock(&unfairLock)

    var producedSound = false

    for frame in 0..<Int(frameCount) {
      let absoluteSample = sampleTime + Double(frame)
      var value: Float = 0

      if playing, let snap = snap {
        let absFrame = absoluteSample - base
        let progression = chordSampleValue(snap: snap, absFrame: absFrame, sr: sr, provider: provider)
        value += progression
      }

      if pvActive {
        let t = (absoluteSample - pvBase) / sr
        if t >= 0 && t < pvDur {
          let velGain = Float(pvVel) / 127.0
          for note in pvNotes {
            value += provider.sample(note: note, tSeconds: t, durationSeconds: pvDur) * velGain
          }
        }
      }

      if value != 0 { producedSound = true }
      writeToAllChannels(buffers, frame: frame, value: value)
    }

    // Advance / expire preview under the lock.
    os_unfair_lock_lock(&unfairLock)
    // UI-only position. Track the absolute playback frame at the END of this
    // buffer ((sampleTime + frameCount) - base); no extra buffer-length offset so
    // the displayed frame doesn't overshoot the audio by one buffer. max() keeps
    // it monotonic. This value never feeds the audio clock (§4.2).
    if playing { currentFrame = max(currentFrame, (sampleTime + Double(frameCount)) - base) }
    if previewActive, let pb = previewBase {
      let elapsed = (sampleTime + Double(frameCount) - pb) / sampleRate
      if elapsed >= previewDurationSec { previewActive = false }
    }
    os_unfair_lock_unlock(&unfairLock)

    isSilence.pointee = ObjCBool(!producedSound)
    return noErr
  }

  private func renderDrum(
    isSilence: UnsafeMutablePointer<ObjCBool>,
    timestamp: UnsafePointer<AudioTimeStamp>,
    frameCount: AVAudioFrameCount,
    abl: UnsafeMutablePointer<AudioBufferList>
  ) -> OSStatus {
    let buffers = UnsafeMutableAudioBufferListPointer(abl)
    let sampleTime = timestamp.pointee.mSampleTime

    os_unfair_lock_lock(&unfairLock)
    let snap = plan
    let playing = isPlaying
    let sr = sampleRate
    // Establish the shared base here too, using the SAME formula as renderChord,
    // so whichever render callback runs first on a fresh start/resume pins the
    // base; the other simply reads it. Prevents a one-buffer skew (§4.2).
    if playing && baseSampleTime == nil { baseSampleTime = sampleTime - pausedFrames }
    let base = baseSampleTime ?? sampleTime
    os_unfair_lock_unlock(&unfairLock)

    var producedSound = false

    for frame in 0..<Int(frameCount) {
      var value: Float = 0
      if playing, let snap = snap {
        let absFrame = (sampleTime + Double(frame)) - base
        value = drumSampleValue(snap: snap, absFrame: absFrame, sr: sr)
      }
      if value != 0 { producedSound = true }
      writeToAllChannels(buffers, frame: frame, value: value)
    }

    isSilence.pointee = ObjCBool(!producedSound)
    return noErr
  }

  private func chordSampleValue(
    snap: PlanSnapshot,
    absFrame: Double,
    sr: Double,
    provider: InstrumentProvider
  ) -> Float {
    let loopFrames = Scheduler.loopLengthFrames(totalBeats: snap.totalBeats, bpm: snap.bpm, sampleRate: sr)
    if !snap.loop && absFrame >= loopFrames {
      signalFinishedIfNeeded()
      return 0
    }
    let folded = Scheduler.fold(absoluteFrame: absFrame, loopLengthFrames: loopFrames, loop: snap.loop)
    let beat = Scheduler.beat(forFrameInLoop: folded.frameInLoop, bpm: snap.bpm, sampleRate: sr)
    let spb = Scheduler.secondsPerBeat(bpm: snap.bpm)

    guard let event = activeEvent(snap: snap, beat: beat) else { return 0 }
    let velGain = Float(event.velocity) / 127.0
    let t = (beat - event.startBeat) * spb
    let dur = event.lengthBeats * spb
    var sum: Float = 0
    for note in event.midiNotes {
      sum += provider.sample(note: note, tSeconds: t, durationSeconds: dur)
    }
    return sum * velGain
  }

  private func drumSampleValue(snap: PlanSnapshot, absFrame: Double, sr: Double) -> Float {
    let loopFrames = Scheduler.loopLengthFrames(totalBeats: snap.totalBeats, bpm: snap.bpm, sampleRate: sr)
    if !snap.loop && absFrame >= loopFrames { return 0 }
    let folded = Scheduler.fold(absoluteFrame: absFrame, loopLengthFrames: loopFrames, loop: snap.loop)
    let beat = Scheduler.beat(forFrameInLoop: folded.frameInLoop, bpm: snap.bpm, sampleRate: sr)
    let spb = Scheduler.secondsPerBeat(bpm: snap.bpm)
    var beatInBar = beat.truncatingRemainder(dividingBy: 4.0)
    if beatInBar < 0 { beatInBar += 4.0 }
    return drumProvider.sample(beatInBar: beatInBar, secondsPerBeat: spb, frame: Int64(absFrame))
  }

  private func activeEvent(snap: PlanSnapshot, beat: Double) -> NoteEventValue? {
    for event in snap.events where beat >= event.startBeat && beat < event.startBeat + event.lengthBeats {
      return event
    }
    return nil
  }

  private func writeToAllChannels(
    _ buffers: UnsafeMutableAudioBufferListPointer,
    frame: Int,
    value: Float
  ) {
    for buffer in buffers {
      guard let data = buffer.mData else { continue }
      let ptr = data.assumingMemoryBound(to: Float.self)
      ptr[frame] = value
    }
  }

  private func signalFinishedIfNeeded() {
    os_unfair_lock_lock(&unfairLock)
    let alreadyFinished = finished
    if !finished { finished = true }
    os_unfair_lock_unlock(&unfairLock)
    if !alreadyFinished {
      DispatchQueue.main.async { [weak self] in self?.stop() }
    }
  }

  // MARK: - Position (UI only)

  private func startPositionTimer() {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.positionTimer?.cancel()
      let timer = DispatchSource.makeTimerSource(queue: .main)
      timer.schedule(deadline: .now(), repeating: 0.05)
      timer.setEventHandler { [weak self] in self?.emitPosition() }
      self.positionTimer = timer
      timer.resume()
    }
  }

  private func stopPositionTimer() {
    DispatchQueue.main.async { [weak self] in
      self?.positionTimer?.cancel()
      self?.positionTimer = nil
    }
  }

  private func emitPosition() {
    os_unfair_lock_lock(&unfairLock)
    let snap = plan
    let frame = currentFrame
    let playing = isPlaying
    let sr = sampleRate
    os_unfair_lock_unlock(&unfairLock)

    guard playing, let snap = snap else { return }
    let loopFrames = Scheduler.loopLengthFrames(totalBeats: snap.totalBeats, bpm: snap.bpm, sampleRate: sr)
    let folded = Scheduler.fold(absoluteFrame: frame, loopLengthFrames: loopFrames, loop: snap.loop)
    let beat = Scheduler.beat(forFrameInLoop: folded.frameInLoop, bpm: snap.bpm, sampleRate: sr)
    var index = -1
    for (i, event) in snap.events.enumerated() where beat >= event.startBeat && beat < event.startBeat + event.lengthBeats {
      index = i
      break
    }
    onPosition?(index, beat, folded.loopIndex)
  }

  // MARK: - Session notifications (§4.1)

  private func registerObservers() {
    let center = NotificationCenter.default
    center.addObserver(
      self,
      selector: #selector(handleInterruption(_:)),
      name: AVAudioSession.interruptionNotification,
      object: nil
    )
    center.addObserver(
      self,
      selector: #selector(handleRouteChange(_:)),
      name: AVAudioSession.routeChangeNotification,
      object: nil
    )
    // The OS stops+uninitializes the engine on a hardware config change (sample
    // rate / channel count). Re-arm it so playback stays audible (§4.1). Nodes
    // remain attached/connected, so a plain start() is enough here.
    center.addObserver(
      self,
      selector: #selector(handleEngineConfigurationChange(_:)),
      name: Notification.Name.AVAudioEngineConfigurationChange,
      object: engine
    )
  }

  @objc private func handleInterruption(_ note: Notification) {
    guard
      let info = note.userInfo,
      let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
      let type = AVAudioSession.InterruptionType(rawValue: raw)
    else { return }
    switch type {
    case .began:
      // Pause on interruption; position is preserved for a later resume().
      pause()
    case .ended:
      // Even if the system suggests .shouldResume, we deliberately do NOT
      // auto-resume playback (avoid surprise playback, §4.1). We only re-arm the
      // engine so a user-triggered resume() from the UI will actually sound. The
      // state (e.g. .paused) is left untouched.
      if let optionsRaw = info[AVAudioSessionInterruptionOptionKey] as? UInt {
        let options = AVAudioSession.InterruptionOptions(rawValue: optionsRaw)
        _ = options.contains(.shouldResume) // intentionally ignored: no auto-resume
      }
      if prepared && !engine.isRunning {
        try? AVAudioSession.sharedInstance().setActive(true)
        try? engine.start()
      }
    @unknown default:
      break
    }
  }

  @objc private func handleEngineConfigurationChange(_ note: Notification) {
    // Posted on an internal queue after the OS stopped the engine. We only read a
    // bool and call start() (never deallocate the engine here, per Apple's
    // deadlock warning), and never take the state lock around start().
    if prepared && !engine.isRunning { try? engine.start() }
  }

  @objc private func handleRouteChange(_ note: Notification) {
    guard
      let info = note.userInfo,
      let raw = info[AVAudioSessionRouteChangeReasonKey] as? UInt,
      let reason = AVAudioSession.RouteChangeReason(rawValue: raw)
    else { return }
    // Headphones unplugged → pause instead of blasting the speaker.
    if reason == .oldDeviceUnavailable { pause() }
  }

  // MARK: - Offline render (Phase 4 export)

  /// Deterministically render `durationSec` of the looped progression + drums to a
  /// temporary `.m4a` and return its URL + sample rate. Independent of the
  /// real-time engine/session (its own providers, fixed 44.1 kHz) so it works even
  /// when playback isn't prepared, and JS-timer-free — sample positions come from
  /// `Scheduler`, the same clock used for playback (sprint-4.md §4).
  func renderToFile(
    bpm: Double,
    totalBeats: Double,
    events: [NoteEventValue],
    instrument: String,
    durationSec: Double
  ) throws -> (url: URL, sampleRate: Double) {
    let sr = 44_100.0
    let program = Self.programForInstrument[instrument] ?? 0
    var chordProv: InstrumentProvider = synthProvider
    if let url = Self.soundFontURL() {
      let sampled = SampledInstrumentProvider(sampleRate: sr)
      if sampled.load(soundFontURL: url, program: program) { chordProv = sampled }
    }
    let drumProv: DrumProvider = SynthDrumProvider()
    let snap = PlanSnapshot(bpm: bpm, totalBeats: max(1, totalBeats), loop: true, events: events)

    let outURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("chord-export-\(UUID().uuidString).m4a")
    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: sr,
      AVNumberOfChannelsKey: 2,
    ]
    let file = try AVAudioFile(forWriting: outURL, settings: settings)
    guard let fmt = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 2) else {
      throw NSError(
        domain: "ChordAudio", code: -1,
        userInfo: [NSLocalizedDescriptionKey: "Could not create render format"])
    }

    let total = Int((durationSec * sr).rounded())
    let chunk = 4096
    // Mirror the real-time mixer defaults (buildEngine) so export loudness matches.
    let masterGain: Float = 0.9
    let chordGain: Float = 0.85
    let drumGain: Float = 0.8

    var frame = 0
    while frame < total {
      let n = min(chunk, total - frame)
      guard
        let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: AVAudioFrameCount(n)),
        let ch = buf.floatChannelData
      else { break }
      buf.frameLength = AVAudioFrameCount(n)
      for i in 0..<n {
        let absFrame = Double(frame + i)
        let c = chordSampleValue(snap: snap, absFrame: absFrame, sr: sr, provider: chordProv)
        let d = offlineDrumSample(snap: snap, absFrame: absFrame, sr: sr, provider: drumProv)
        var v = (c * chordGain + d * drumGain) * masterGain
        if v > 1 { v = 1 } else if v < -1 { v = -1 }
        ch[0][i] = v
        ch[1][i] = v
      }
      try file.write(from: buf)
      frame += n
    }
    return (outURL, sr)
  }

  private func offlineDrumSample(
    snap: PlanSnapshot,
    absFrame: Double,
    sr: Double,
    provider: DrumProvider
  ) -> Float {
    let loopFrames = Scheduler.loopLengthFrames(totalBeats: snap.totalBeats, bpm: snap.bpm, sampleRate: sr)
    let folded = Scheduler.fold(absoluteFrame: absFrame, loopLengthFrames: loopFrames, loop: true)
    let beat = Scheduler.beat(forFrameInLoop: folded.frameInLoop, bpm: snap.bpm, sampleRate: sr)
    let spb = Scheduler.secondsPerBeat(bpm: snap.bpm)
    var beatInBar = beat.truncatingRemainder(dividingBy: 4.0)
    if beatInBar < 0 { beatInBar += 4.0 }
    return provider.sample(beatInBar: beatInBar, secondsPerBeat: spb, frame: Int64(absFrame))
  }
}

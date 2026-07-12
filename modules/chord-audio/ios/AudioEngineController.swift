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
  private let chordProvider: InstrumentProvider = SynthInstrumentProvider()
  private let drumProvider: DrumProvider = SynthDrumProvider()
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
      state = .ready
    } catch {
      state = .failed
      throw error
    }
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

  func play(bpm: Double, totalBeats: Double, loop: Bool, events: [NoteEventValue]) {
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

  func previewChord(notes: [Int], velocity: Int, durationSec: Double) {
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
    var lastFrameAbs = base

    for frame in 0..<Int(frameCount) {
      let absoluteSample = sampleTime + Double(frame)
      var value: Float = 0

      if playing, let snap = snap {
        let absFrame = absoluteSample - base
        lastFrameAbs = absFrame
        let progression = chordSampleValue(snap: snap, absFrame: absFrame, sr: sr)
        value += progression
      }

      if pvActive {
        let t = (absoluteSample - pvBase) / sr
        if t >= 0 && t < pvDur {
          let velGain = Float(pvVel) / 127.0
          for note in pvNotes {
            value += chordProvider.sample(note: note, tSeconds: t, durationSeconds: pvDur) * velGain
          }
        }
      }

      if value != 0 { producedSound = true }
      writeToAllChannels(buffers, frame: frame, value: value)
    }

    // Advance / expire preview under the lock.
    os_unfair_lock_lock(&unfairLock)
    if playing { currentFrame = max(currentFrame, lastFrameAbs + Double(frameCount)) }
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

  private func chordSampleValue(snap: PlanSnapshot, absFrame: Double, sr: Double) -> Float {
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
      sum += chordProvider.sample(note: note, tSeconds: t, durationSeconds: dur)
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
  }

  @objc private func handleInterruption(_ note: Notification) {
    guard
      let info = note.userInfo,
      let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
      let type = AVAudioSession.InterruptionType(rawValue: raw)
    else { return }
    // Pause on interruption; do NOT auto-resume (avoid surprise playback).
    if type == .began { pause() }
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
}

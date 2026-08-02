import AVFoundation
import os

/// Immutable snapshot of what to play. Swapped atomically under the lock so the
/// audio thread never reads a half-mutated plan.
/// One pre-scheduled note: an instrument voice to play at `start` frames into the
/// loop, for `dur` frames, at final linear `gain`. Precomputed OFF the audio
/// thread (velocity/humanize/sparkle/anticipation/ring-cap already resolved) so
/// the real-time render callback only sums voices — no allocation, no scanning.
struct NoteStrike {
  let start: Int // frames from loop head
  let dur: Int // frames
  let note: Int // MIDI
  let gain: Float // final linear gain
}

final class PlanSnapshot {
  let bpm: Double
  let totalBeats: Double
  let loop: Bool
  let events: [NoteEventValue]
  /// Drum groove id (requirements §5.6). Resolved to a concrete pattern by the
  /// DrumProvider on the audio thread.
  let drumPattern: String
  /// Accompaniment rhythm id (requirements §5.5): block / eightBeat /
  /// sixteenthBeat / arpeggio.
  let accompaniment: String
  /// Precomputed chord/accompaniment note strikes for ONE loop, sorted by start.
  /// Built once (off the audio thread) from the accompaniment pattern.
  let chordStrikes: [NoteStrike]
  /// Precompiled TS Groove Engine drum hits for ONE 4/4 bar (voice already
  /// resolved off the audio thread). Empty → the DrumProvider resolves the
  /// concrete pattern from `drumPattern` (older Dev Client fallback).
  let drumHits: [DrumVoiceHit]

  init(
    bpm: Double,
    totalBeats: Double,
    loop: Bool,
    events: [NoteEventValue],
    drumPattern: String = "pop8",
    accompaniment: String = "block",
    chordStrikes: [NoteStrike] = [],
    drumHits: [DrumVoiceHit] = []
  ) {
    self.bpm = bpm
    self.totalBeats = totalBeats
    self.loop = loop
    self.events = events
    self.drumPattern = drumPattern
    self.accompaniment = accompaniment
    self.chordStrikes = chordStrikes
    self.drumHits = drumHits
  }
}

struct NoteEventValue {
  let midiNotes: [Int]
  let startBeat: Double
  let lengthBeats: Double
  let velocity: Int
}

/// Beat-level strike from the TS Groove Engine (converted to frames at device SR).
struct BeatStrikeValue {
  let startBeat: Double
  let durationBeats: Double
  let note: Int
  let gain: Float
}

/// Beat-level drum hit from the TS Groove Engine (voice as string on the wire).
/// Resolved to a `DrumVoiceHit` off the audio thread before it enters the snapshot.
struct DrumHitValue {
  let beat: Double
  let voice: String
  let vel: Float
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
  /// The most recent SampledInstrumentProvider we tried to load — retained even on
  /// failure so `audioDiagnostics()` can surface its `lastLoadError` to JS.
  private var lastSampledAttempt: SampledInstrumentProvider?
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

  private static let soundFontNames = ["FluidR3_GM2-2"]
  private static let soundFontExts = ["SF2", "sf2"]

  /// Candidate bundles the SoundFont could live in for a CocoaPods static
  /// framework: the module's own bundle, the app bundle, and the named
  /// `ChordAudioAssets` resource bundle nested in either.
  private static func candidateBundles() -> [Bundle] {
    var bundles: [Bundle] = [Bundle(for: AudioEngineController.self), Bundle.main]
    for base in [Bundle(for: AudioEngineController.self), Bundle.main] {
      if let url = base.url(forResource: "ChordAudioAssets", withExtension: "bundle"),
        let assets = Bundle(url: url) {
        bundles.append(assets)
      }
    }
    return bundles
  }

  /// Locate the bundled General MIDI SoundFont across the possible bundles a
  /// CocoaPods static framework / resource bundle can end up in. Falls back to a
  /// recursive scan of the resource roots so a resource bundle that landed under
  /// an unexpected subdirectory (or a renamed bundle) is still found.
  private static func soundFontURL() -> URL? {
    // 1. Fast path: direct named lookup in each candidate bundle.
    for bundle in candidateBundles() {
      for name in soundFontNames {
        for ext in soundFontExts {
          if let url = bundle.url(forResource: name, withExtension: ext) { return url }
        }
      }
    }
    // 2. Fallback: recursively scan the resource roots for ANY *.SF2 file. Runs
    //    once on the (non-audio) calling thread during setInstrument.
    let lowerExts = Set(soundFontExts.map { $0.lowercased() })
    for root in resourceRoots() {
      guard
        let en = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil)
      else { continue }
      for case let url as URL in en where lowerExts.contains(url.pathExtension.lowercased()) {
        return url
      }
    }
    return nil
  }

  /// Resource directories scanned as a last resort, and reported by diagnostics.
  private static func resourceRoots() -> [URL] {
    var roots: [URL] = []
    if let u = Bundle(for: AudioEngineController.self).resourceURL { roots.append(u) }
    if let u = Bundle.main.resourceURL, !roots.contains(u) { roots.append(u) }
    return roots
  }

  /// Snapshot of SoundFont resolution + load state for JS-side diagnostics. Safe
  /// to call anytime; touches the filesystem but not the audio thread.
  func audioDiagnostics() -> [String: Any] {
    var result: [String: Any] = [:]
    let url = Self.soundFontURL()
    result["soundFontFound"] = (url != nil)
    if let url = url {
      result["soundFontPath"] = url.path
      if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
        let size = attrs[.size] as? NSNumber {
        // 134 ≈ a Git-LFS pointer smuggled into the bundle; ~148 MB = the real file.
        result["soundFontBytes"] = size.intValue
      }
    }
    os_unfair_lock_lock(&unfairLock)
    let provider = chordProvider
    os_unfair_lock_unlock(&unfairLock)
    result["sampledLoaded"] = provider is SampledInstrumentProvider
    result["currentInstrument"] = currentInstrument
    result["prepared"] = prepared
    if let err = lastSampledAttempt?.lastLoadError {
      result["lastLoadError"] = err
    }
    result["searchedBundlePaths"] = Self.candidateBundles().map { $0.bundlePath }
    result["searchedResourceRoots"] = Self.resourceRoots().map { $0.path }
    return result
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
      // Retain before load so a failed attempt's lastLoadError stays observable.
      lastSampledAttempt = sampled
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

  func play(
    bpm: Double,
    totalBeats: Double,
    loop: Bool,
    events: [NoteEventValue],
    drumPattern: String,
    accompaniment: String,
    instrument: String,
    precompiledStrikes: [BeatStrikeValue] = [],
    precompiledDrumHits: [DrumHitValue] = []
  ) {
    // §3.1: play() is a fresh-from-top playback, never a resume. It is only valid
    // once the engine is prepared and from ready/playing/paused/stopped. From
    // idle/preparing/failed it is a no-op (no state change, no onStateChange).
    // Gate BEFORE taking the lock or building a snapshot.
    guard prepared, state == .ready || state == .playing || state == .paused || state == .stopped else {
      return
    }
    // Ensure the requested voice is loaded before playback (no-op if unchanged).
    setInstrument(instrument)
    // Prefer TS Groove Engine strikes when present; otherwise expand natively.
    let strikes = resolveChordStrikes(
      precompiled: precompiledStrikes, bpm: bpm, totalBeats: totalBeats, events: events,
      accompaniment: accompaniment, sr: sampleRate)
    // Resolve drum hits off the audio thread (string voice → enum). Empty → the
    // DrumProvider expands the concrete pattern from the groove id at render time.
    let drumHits = Self.resolveDrumHits(precompiledDrumHits)
    let snapshot = PlanSnapshot(
      bpm: bpm, totalBeats: totalBeats, loop: loop, events: events,
      drumPattern: drumPattern, accompaniment: accompaniment, chordStrikes: strikes,
      drumHits: drumHits
    )
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

  /// Real-time chord render: allocation-free and cheap. Folds the absolute frame
  /// into the loop and sums every precomputed strike currently sounding. All the
  /// musical decisions were made off the audio thread in `buildChordStrikes`.
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
    let fi = Int(folded.frameInLoop)

    var sum: Float = 0
    for strike in snap.chordStrikes {
      let rel = fi - strike.start
      if rel < 0 || rel >= strike.dur { continue }
      let t = Double(rel) / sr
      sum += provider.sample(note: strike.note, tSeconds: t, durationSeconds: Double(strike.dur) / sr)
        * strike.gain
    }
    // Soft-clip the summed voices (tanh) — smooth headroom, no hard digital clip.
    return tanh(sum)
  }

  // MARK: - Accompaniment (driving, human-feel comping)

  /// A single articulation on the bar grid. `beat` is its position within the bar
  /// (0..4), `vel` its base velocity (0..1), and `look` an anticipation amount in
  /// beats: the harmony is looked up `look` beats AHEAD, so an off-beat can grab
  /// the upcoming chord early (the "食い"/push that gives momentum).
  private struct CompStroke { let beat: Double; let vel: Float; var look: Double = 0 }

  /// Deterministic ±jitter so identical render == identical playback, but the
  /// velocities stop sounding machine-flat. Seed off the onset+note.
  private static func humanize(_ base: Float, seed: Double, amount: Float = 0.07) -> Float {
    guard amount > 0 else { return max(0.0, min(1.0, base)) }
    let h = sin(seed * 12.9898) * 43_758.5453
    let frac = h - floor(h) // [0,1)
    let jitter = Float(frac * 2 - 1) * amount
    return max(0.0, min(1.0, base * (1.0 + jitter)))
  }

  /// Deterministic micro timing sway in beats (±amount). Same seed → same offset
  /// so playback and offline export stay bit-identical.
  private static func timingSway(seed: Double, amountBeats: Double) -> Double {
    guard amountBeats > 0 else { return 0 }
    let h = sin(seed * 7.1321) * 43_758.5453
    let frac = h - floor(h)
    return (frac * 2 - 1) * amountBeats
  }

  /// Chord notes sounding at `beat` (loop-folded). Build-time only.
  private func notesAt(events: [NoteEventValue], totalBeats: Double, beat: Double) -> [Int] {
    var b = beat
    if totalBeats > 0 {
      b = b.truncatingRemainder(dividingBy: totalBeats)
      if b < 0 { b += totalBeats }
    }
    for e in events where b >= e.startBeat && b < e.startBeat + e.lengthBeats { return e.midiNotes }
    return []
  }

  /// Event velocity (0..1) active at `beat`. Defaults to 100/127. Build-time only.
  private func velAt(events: [NoteEventValue], totalBeats: Double, beat: Double) -> Float {
    var b = beat
    if totalBeats > 0 {
      b = b.truncatingRemainder(dividingBy: totalBeats)
      if b < 0 { b += totalBeats }
    }
    for e in events where b >= e.startBeat && b < e.startBeat + e.lengthBeats {
      return Float(e.velocity) / 127.0
    }
    return 100.0 / 127.0
  }

  /// Beats from `refBeat` to the next chord change (or loop seam). Build-time only.
  private func beatsUntilChordChange(
    events: [NoteEventValue], totalBeats: Double, after refBeat: Double
  ) -> Double {
    guard totalBeats > 0 else { return .greatestFiniteMagnitude }
    let iterBase = floor(refBeat / totalBeats) * totalBeats
    var best = Double.greatestFiniteMagnitude
    for e in events {
      for cand in [iterBase + e.startBeat, iterBase + totalBeats + e.startBeat]
      where cand > refBeat + 1e-6 {
        best = min(best, cand - refBeat)
      }
    }
    return best
  }

  /// Ring length (beats) for a note struck at `onset` belonging to the chord `look`
  /// beats ahead, capped so it stops when THAT chord ends (un-pedal on change — the
  /// anticipated note still rings THROUGH the downbeat it pushes into). Build-time.
  private func ringCap(
    events: [NoteEventValue], totalBeats: Double, onset: Double, look: Double, nominal: Double
  ) -> Double {
    let until = beatsUntilChordChange(events: events, totalBeats: totalBeats, after: onset + look)
    return max(0.05, min(nominal, look + until + 0.06))
  }

  /// Resolve wire drum hits (voice string) into synthesizable `DrumVoiceHit`s.
  /// Unknown voice strings are dropped. Runs OFF the audio thread so the render
  /// callback iterates a ready list with no allocation or string comparison.
  private static func resolveDrumHits(_ hits: [DrumHitValue]) -> [DrumVoiceHit] {
    guard !hits.isEmpty else { return [] }
    var out: [DrumVoiceHit] = []
    out.reserveCapacity(hits.count)
    for h in hits {
      guard let voice = DrumVoiceKind(rawValue: h.voice) else { continue }
      out.append(DrumVoiceHit(beat: h.beat, voice: voice, vel: h.vel))
    }
    return out
  }

  /// Prefer precompiled TS strikes (beat → frames at `sr`); fall back to native expand.
  private func resolveChordStrikes(
    precompiled: [BeatStrikeValue],
    bpm: Double,
    totalBeats: Double,
    events: [NoteEventValue],
    accompaniment: String,
    sr: Double
  ) -> [NoteStrike] {
    if !precompiled.isEmpty {
      return Self.frameStrikes(from: precompiled, bpm: bpm, totalBeats: totalBeats, sr: sr)
    }
    return buildChordStrikes(
      bpm: bpm, totalBeats: totalBeats, events: events, accompaniment: accompaniment, sr: sr)
  }

  /// Convert beat-level TS strikes into frame NoteStrikes using the engine sample rate.
  private static func frameStrikes(
    from beats: [BeatStrikeValue], bpm: Double, totalBeats: Double, sr: Double
  ) -> [NoteStrike] {
    let fpb = Scheduler.framesPerBeat(bpm: bpm, sampleRate: sr)
    guard fpb > 0, totalBeats > 0 else { return [] }
    let loopFrames = Int((totalBeats * fpb).rounded())
    guard loopFrames > 0 else { return [] }
    var out: [NoteStrike] = []
    out.reserveCapacity(beats.count)
    for s in beats {
      let start = Int((s.startBeat * fpb).rounded())
      if start < 0 || start >= loopFrames { continue }
      let dur = min(max(1, Int((s.durationBeats * fpb).rounded())), loopFrames - start)
      if dur <= 0 { continue }
      out.append(NoteStrike(start: start, dur: dur, note: s.note, gain: s.gain))
    }
    return out
  }

  /// Precompute the accompaniment as a flat list of NoteStrikes for ONE loop.
  /// Runs OFF the audio thread (allocation is fine here); the render callback then
  /// only sums the active strikes. This is what makes the engine cheap enough to
  /// never underrun. Musical principles baked in here (how uptempo pop/rock is
  /// played): bass locks the pulse on strong beats; the chord drives in steady
  /// 8th/16ths with down-beats hit and up-beats anticipating the next chord (食い);
  /// a soft top-octave adds "sparkle"; every note's ring is cut at the chord change
  /// (un-pedal) for clarity. Chord events stay 1:1 with the timeline (highlight-safe).
  ///
  /// Kept as fallback while TS precompile rolls out (empty `chordStrikes` from JS).
  private func buildChordStrikes(
    bpm: Double, totalBeats: Double, events: [NoteEventValue], accompaniment: String, sr: Double
  ) -> [NoteStrike] {
    guard totalBeats > 0, !events.isEmpty, sr > 0 else { return [] }
    let fpb = Scheduler.framesPerBeat(bpm: bpm, sampleRate: sr)
    guard fpb > 0 else { return [] }
    let loopFrames = Int((totalBeats * fpb).rounded())
    guard loopFrames > 0 else { return [] }
    var out: [NoteStrike] = []

    // Emit a (possibly strummed / sparkled) group of notes for one onset.
    // `timingAmount` / `velAmount` control human feel; block passes 0 for both so
    // hits stay locked to the beat with flat, even velocity.
    func emitGroup(
      onsetBeat: Double, look: Double, baseVel: Float, nominalRing: Double,
      strumSec: Double, sparkle: Bool, select: (Int) -> Bool,
      timingAmount: Double = 0, velAmount: Float = 0.07
    ) {
      let notes = notesAt(events: events, totalBeats: totalBeats, beat: onsetBeat + look)
        .filter(select).sorted()
      guard !notes.isEmpty else { return }
      let ringB = ringCap(
        events: events, totalBeats: totalBeats, onset: onsetBeat, look: look, nominal: nominalRing)
      let durF = max(1, Int((ringB * fpb).rounded()))
      let vGain = velAt(events: events, totalBeats: totalBeats, beat: onsetBeat + look)
      let sway = Self.timingSway(seed: onsetBeat + look, amountBeats: timingAmount)
      let onsetFrame = Int(((onsetBeat + sway) * fpb).rounded())
      let strumF = Int((strumSec * sr).rounded())
      var voiced = notes
      let top12 = (notes.max() ?? 0) + 12
      if sparkle { voiced.append(top12) }
      for (i, note) in voiced.enumerated() {
        let start = onsetFrame + i * strumF
        if start < 0 || start >= loopFrames { continue }
        let dur = min(durF, loopFrames - start)
        if dur <= 0 { continue }
        let vv: Float = (sparkle && note == top12) ? baseVel * 0.5 : baseVel
        let gain = Self.humanize(vv, seed: onsetBeat + Double(note), amount: velAmount) * vGain
        out.append(NoteStrike(start: start, dur: dur, note: note, gain: gain))
      }
    }

    // Emit a bar-locked grid of strokes across the whole loop.
    func emitGrid(
      _ strokes: [CompStroke], nominalRing: Double, strumSec: Double,
      sparkle: Bool, select: (Int) -> Bool,
      timingAmount: Double = 0, velAmount: Float = 0.07
    ) {
      let barCount = max(1, Int(ceil(totalBeats / 4.0 - 1e-9)))
      for bi in 0..<barCount {
        for st in strokes {
          let onsetBeat = Double(bi) * 4.0 + st.beat
          if onsetBeat >= totalBeats - 1e-9 { continue }
          emitGroup(
            onsetBeat: onsetBeat, look: st.look, baseVel: st.vel, nominalRing: nominalRing,
            strumSec: strumSec, sparkle: sparkle, select: select,
            timingAmount: timingAmount, velAmount: velAmount)
        }
      }
    }

    let isBass: (Int) -> Bool = { $0 < 48 }
    let isBody: (Int) -> Bool = { $0 >= 48 }
    let isAll: (Int) -> Bool = { _ in true }

    switch accompaniment {
    case "eightBeat":
      // Solid quarter bass on the grid (no syncopation / no sway). Body plays 8ths
      // with velocity waves, light anticipation on upbeats (食い), and a touch of
      // timing sway so it feels human without leaving the pocket.
      emitGrid(
        [
          CompStroke(beat: 0, vel: 1.0), CompStroke(beat: 1, vel: 0.92),
          CompStroke(beat: 2, vel: 0.96), CompStroke(beat: 3, vel: 0.90),
        ],
        nominalRing: 0.95, strumSec: 0, sparkle: false, select: isBass,
        timingAmount: 0, velAmount: 0.03)
      emitGrid(
        [
          CompStroke(beat: 0, vel: 0.96, look: 0),
          CompStroke(beat: 0.5, vel: 0.58, look: 0.04),
          CompStroke(beat: 1, vel: 0.78, look: 0),
          CompStroke(beat: 1.5, vel: 0.66, look: 0.06),
          CompStroke(beat: 2, vel: 0.92, look: 0),
          CompStroke(beat: 2.5, vel: 0.55, look: 0.04),
          CompStroke(beat: 3, vel: 0.80, look: 0),
          CompStroke(beat: 3.5, vel: 0.70, look: 0.08),
        ],
        nominalRing: 0.48, strumSec: 0.005, sparkle: true, select: isBody,
        timingAmount: 0.018, velAmount: 0.11)

    case "sixteenthBeat":
      // Grid bass + busy 16th body. Ghost notes on the "e"/"a", push on the "a"
      // before downbeats, velocity undulates, slight timing sway.
      emitGrid(
        [
          CompStroke(beat: 0, vel: 1.0), CompStroke(beat: 1, vel: 0.90),
          CompStroke(beat: 2, vel: 0.96), CompStroke(beat: 3, vel: 0.88),
        ],
        nominalRing: 0.95, strumSec: 0, sparkle: false, select: isBass,
        timingAmount: 0, velAmount: 0.03)
      var body16: [CompStroke] = []
      var sixteenth = 0.0
      while sixteenth < 4.0 - 1e-9 {
        let slot = Int((sixteenth * 4.0).rounded()) % 4 // 0=↓ 1=e 2=& 3=a
        let onQuarter = slot == 0
        let onEighth = slot == 2
        let vel: Float
        let look: Double
        if onQuarter {
          vel = 0.94; look = 0
        } else if onEighth {
          vel = 0.72; look = 0.03
        } else if slot == 3 {
          // "a" — lean into the next downbeat (syncopation / 食い).
          vel = 0.68; look = 0.07
        } else {
          // "e" — ghost
          vel = 0.48; look = 0.02
        }
        body16.append(CompStroke(beat: sixteenth, vel: vel, look: look))
        sixteenth += 0.25
      }
      emitGrid(
        body16, nominalRing: 0.24, strumSec: 0.002, sparkle: false, select: isBody,
        timingAmount: 0.014, velAmount: 0.12)

    case "arpeggio":
      // Sustained bass drone per chord (rings to the chord change) …
      for e in events {
        emitGroup(
          onsetBeat: e.startBeat, look: 0, baseVel: 0.8, nominalRing: e.lengthBeats,
          strumSec: 0, sparkle: false, select: isBass)
      }
      // … plus a fast 16th broken chord over the body notes.
      let step = 0.25
      let order = [0, 1, 2, 3, 4, 2]
      var stepIndex = 0
      while true {
        let onsetBeat = Double(stepIndex) * step
        if onsetBeat >= totalBeats - 1e-9 { break }
        let body = notesAt(events: events, totalBeats: totalBeats, beat: onsetBeat)
          .filter(isBody).sorted()
        if !body.isEmpty {
          let ringB = ringCap(
            events: events, totalBeats: totalBeats, onset: onsetBeat, look: 0, nominal: 1.3)
          let durF = max(1, Int((ringB * fpb).rounded()))
          let pick = order[((stepIndex % order.count) + order.count) % order.count]
          let note = body[pick % body.count]
          let onQuarter = (stepIndex % 4 == 0)
          let onEighth = (stepIndex % 2 == 0)
          let baseVel: Float = onQuarter ? 0.85 : (onEighth ? 0.66 : 0.74)
          let start = Int((onsetBeat * fpb).rounded())
          let dur = min(durF, loopFrames - start)
          if start >= 0 && start < loopFrames && dur > 0 {
            let gain = Self.humanize(baseVel, seed: onsetBeat + Double(note))
              * velAt(events: events, totalBeats: totalBeats, beat: onsetBeat)
            out.append(NoteStrike(start: start, dur: dur, note: note, gain: gain))
          }
        }
        stepIndex += 1
      }

    default: // "block"
      // Chord-locked block hits on each chord start only — no syncopation, no
      // timing sway, nearly flat velocity. Soft roll + sparkle for piano feel.
      for e in events {
        emitGroup(
          onsetBeat: e.startBeat, look: 0, baseVel: 0.92, nominalRing: e.lengthBeats,
          strumSec: 0.012, sparkle: true, select: isAll,
          timingAmount: 0, velAmount: 0.02)
      }
    }

    return out
  }

  private func drumSampleValue(snap: PlanSnapshot, absFrame: Double, sr: Double) -> Float {
    let loopFrames = Scheduler.loopLengthFrames(totalBeats: snap.totalBeats, bpm: snap.bpm, sampleRate: sr)
    if !snap.loop && absFrame >= loopFrames { return 0 }
    let folded = Scheduler.fold(absoluteFrame: absFrame, loopLengthFrames: loopFrames, loop: snap.loop)
    let beat = Scheduler.beat(forFrameInLoop: folded.frameInLoop, bpm: snap.bpm, sampleRate: sr)
    let spb = Scheduler.secondsPerBeat(bpm: snap.bpm)
    var beatInBar = beat.truncatingRemainder(dividingBy: 4.0)
    if beatInBar < 0 { beatInBar += 4.0 }
    // Prefer precompiled TS drum hits; otherwise expand the groove-id pattern.
    if !snap.drumHits.isEmpty {
      return drumProvider.sample(
        hits: snap.drumHits, beatInBar: beatInBar, secondsPerBeat: spb, frame: Int64(absFrame)
      )
    }
    return drumProvider.sample(
      groove: snap.drumPattern, beatInBar: beatInBar, secondsPerBeat: spb, frame: Int64(absFrame)
    )
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
    drumPattern: String,
    accompaniment: String,
    instrument: String,
    durationSec: Double,
    precompiledStrikes: [BeatStrikeValue] = [],
    precompiledDrumHits: [DrumHitValue] = []
  ) throws -> (url: URL, sampleRate: Double) {
    let sr = 44_100.0
    let program = Self.programForInstrument[instrument] ?? 0
    var chordProv: InstrumentProvider = synthProvider
    if let url = Self.soundFontURL() {
      let sampled = SampledInstrumentProvider(sampleRate: sr)
      if sampled.load(soundFontURL: url, program: program) { chordProv = sampled }
    }
    let drumProv: DrumProvider = SynthDrumProvider()
    let beats = max(1, totalBeats)
    let strikes = resolveChordStrikes(
      precompiled: precompiledStrikes, bpm: bpm, totalBeats: beats, events: events,
      accompaniment: accompaniment, sr: sr)
    let drumHits = Self.resolveDrumHits(precompiledDrumHits)
    let snap = PlanSnapshot(
      bpm: bpm, totalBeats: beats, loop: true, events: events,
      drumPattern: drumPattern, accompaniment: accompaniment, chordStrikes: strikes,
      drumHits: drumHits
    )

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
    // Export must match playback: prefer precompiled TS hits, else groove-id expand.
    if !snap.drumHits.isEmpty {
      return provider.sample(
        hits: snap.drumHits, beatInBar: beatInBar, secondsPerBeat: spb, frame: Int64(absFrame)
      )
    }
    return provider.sample(
      groove: snap.drumPattern, beatInBar: beatInBar, secondsPerBeat: spb, frame: Int64(absFrame)
    )
  }
}

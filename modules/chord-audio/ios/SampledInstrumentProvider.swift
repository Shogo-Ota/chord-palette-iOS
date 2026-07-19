import AVFoundation
import os

/// Real instrument voice (Phase 2B). Backed by a General MIDI SoundFont loaded
/// through `AVAudioUnitSampler`. Because the engine drives audio through a pull
/// model (`sample(note:tSeconds:durationSeconds:)`) rather than routing a live
/// sampler node, we pre-render each MIDI note to a PCM buffer ONCE at load time
/// (offline), then read back samples in the real-time render callback. This keeps
/// the proven scheduler/mixer/transport untouched (sprint-2.md §10) while giving
/// a genuine sampled timbre.
final class SampledInstrumentProvider: InstrumentProvider {
  /// Lowest note pre-rendered (C1 — covers the doubled sub-octave bass) up to C6.
  /// Extending down an octave from C2 gives the voicing real low-frequency weight
  /// instead of a thin mid-register sound.
  private let lowNote = 24
  private let highNote = 84
  /// How long each note is captured. Long enough to include the natural decay.
  private let captureSeconds = 3.0
  /// Output headroom so 4-note polyphony stays under clipping before the mixer.
  private let gain: Float = 0.6

  /// Peak amplitude below which a captured note buffer is treated as "silent"
  /// (i.e. the sampler failed to page the region in before we captured it). A
  /// genuine mezzo-forte note peaks well above 0.05; a truly dead capture sits
  /// at the noise floor (< 1e-4). The threshold is comfortably between the two.
  private let silenceThreshold: Float = 5e-4
  /// How many times to warm-up-and-recapture a note that came back silent
  /// before giving up and recording it in `sampledSilentNotes`.
  private let maxCaptureAttempts = 3

  private let sampleRate: Double
  private var buffers: [Int: [Float]] = [:]
  private let log = OSLog(subsystem: "app.chord-palette.audio", category: "Sampler")

  private(set) var isLoaded = false
  /// Human-readable reason the most recent `load()` failed (or nil on success /
  /// before any attempt). Surfaced to JS via `getAudioDiagnostics` so the root
  /// cause is observable from Metro logs without reading native `os_log`.
  private(set) var lastLoadError: String?

  /// MIDI notes whose pre-rendered buffer was still (near-)silent after every
  /// retry. Empty on a healthy load; a populated list is the direct fingerprint
  /// of the "mid/high register is inaudible" bug. Exposed via diagnostics.
  private(set) var silentNotes: [Int] = []
  /// Peak amplitude captured per MIDI note (post-gain not applied — raw sampler
  /// output). Used for the per-octave diagnostic summary.
  private var peakByNote: [Int: Float] = [:]

  init(sampleRate: Double) {
    self.sampleRate = sampleRate
  }

  /// Pre-render every note for `program` from `soundFontURL`. Returns false (and
  /// leaves `isLoaded == false`) if the soundfont could not be loaded so the
  /// caller can fall back to the synth provider. Runs off the audio thread.
  func load(soundFontURL: URL, program: UInt8) -> Bool {
    buffers.removeAll()
    silentNotes.removeAll()
    peakByNote.removeAll()
    isLoaded = false
    lastLoadError = nil

    let engine = AVAudioEngine()
    let sampler = AVAudioUnitSampler()
    engine.attach(sampler)

    guard let fmt = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1) else {
      lastLoadError = "Could not create mono AVAudioFormat at \(sampleRate) Hz"
      return false
    }
    engine.connect(sampler, to: engine.mainMixerNode, format: fmt)

    do {
      try engine.enableManualRenderingMode(.offline, format: fmt, maximumFrameCount: 4096)
      try sampler.loadSoundBankInstrument(
        at: soundFontURL,
        program: program,
        bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB),
        bankLSB: UInt8(kAUSampler_DefaultBankLSB)
      )
      try engine.start()
    } catch {
      lastLoadError = "loadSoundBankInstrument/start failed: \(String(describing: error))"
      os_log("SoundFont load failed: %{public}@", log: log, type: .error, String(describing: error))
      engine.stop()
      return false
    }

    guard
      let scratch = AVAudioPCMBuffer(
        pcmFormat: engine.manualRenderingFormat,
        frameCapacity: engine.manualRenderingMaximumFrameCount
      )
    else {
      lastLoadError = "Could not allocate offline render scratch buffer"
      engine.stop()
      return false
    }

    let totalFrames = AVAudioFrameCount(captureSeconds * sampleRate)

    // Prime the sampler BEFORE capturing anything. `loadSoundBankInstrument`
    // pages sample regions in lazily/asynchronously; the first note(s) struck
    // against a cold soundbank render silent (or as a default sine). Rendering
    // ~1s of engine time with no note playing lets the bank finish loading, and
    // a dummy strike across the register warms the voice allocator so the very
    // first *real* capture below already has its region resident.
    renderSilence(engine: engine, scratch: scratch, seconds: 1.0)
    warmUpRegisters(engine: engine, sampler: sampler, scratch: scratch)

    for note in lowNote...highNote {
      var collected = captureNote(
        note, engine: engine, sampler: sampler, scratch: scratch, totalFrames: totalFrames)
      var peak = bufferPeak(collected)

      // Retry silent captures: an inaudible buffer means the region was still
      // cold. Striking it once has now triggered its load, so an extra warm-up
      // render followed by a fresh capture usually succeeds.
      var attempt = 1
      while peak < silenceThreshold && attempt < maxCaptureAttempts {
        renderSilence(engine: engine, scratch: scratch, seconds: 0.5)
        collected = captureNote(
          note, engine: engine, sampler: sampler, scratch: scratch, totalFrames: totalFrames)
        peak = bufferPeak(collected)
        attempt += 1
      }

      buffers[note] = collected
      peakByNote[note] = peak
      if peak < silenceThreshold {
        silentNotes.append(note)
        os_log(
          "Sampled note %d still silent after %d attempts (peak=%{public}f)",
          log: log, type: .error, note, attempt, Double(peak))
      }
    }

    engine.stop()
    isLoaded = !buffers.isEmpty
    if !isLoaded {
      lastLoadError = "SoundFont loaded but no note buffers were rendered"
    } else if !silentNotes.isEmpty {
      // Non-fatal: the sampled voice still loads (low notes are audible), but we
      // record the dead register so the JS diagnostics make the regression
      // obvious instead of it surfacing only as "mid/high chords are silent".
      lastLoadError =
        "Sampled but \(silentNotes.count) note(s) rendered silent: \(silentNotes)"
    }
    return isLoaded
  }

  /// Advance the offline engine by `seconds` of render time with no note
  /// playing. Used to (a) let the soundbank finish paging in and (b) drain a
  /// note's release tail so the next capture starts from silence.
  private func renderSilence(engine: AVAudioEngine, scratch: AVAudioPCMBuffer, seconds: Double) {
    var remaining = AVAudioFrameCount(max(0, seconds) * sampleRate)
    while remaining > 0 {
      let toRender = min(engine.manualRenderingMaximumFrameCount, remaining)
      let status = (try? engine.renderOffline(toRender, to: scratch)) ?? .error
      if status != .success { break }
      let rendered = AVAudioFrameCount(scratch.frameLength)
      // Guard against a stalled render (frameLength == 0) turning into a spin.
      if rendered == 0 { break }
      remaining = remaining > rendered ? remaining - rendered : 0
    }
  }

  /// Briefly strike notes spread across the whole capture range so every sample
  /// region is resident before per-note capture begins. Notes are released and
  /// the release tail drained; the audio is discarded.
  private func warmUpRegisters(
    engine: AVAudioEngine, sampler: AVAudioUnitSampler, scratch: AVAudioPCMBuffer
  ) {
    var struck = [UInt8]()
    var n = lowNote
    while n <= highNote {
      let note = UInt8(n)
      sampler.startNote(note, withVelocity: 100, onChannel: 0)
      struck.append(note)
      n += 6
    }
    renderSilence(engine: engine, scratch: scratch, seconds: 0.5)
    for note in struck { sampler.stopNote(note, onChannel: 0) }
    renderSilence(engine: engine, scratch: scratch, seconds: 0.3)
  }

  /// Capture a single note's decay into a mono float buffer. Decrements by the
  /// frames actually rendered (not the requested count) and bails on a stalled
  /// render so a short read can never spin forever.
  private func captureNote(
    _ note: Int, engine: AVAudioEngine, sampler: AVAudioUnitSampler,
    scratch: AVAudioPCMBuffer, totalFrames: AVAudioFrameCount
  ) -> [Float] {
    sampler.startNote(UInt8(note), withVelocity: 100, onChannel: 0)
    var collected = [Float]()
    collected.reserveCapacity(Int(totalFrames))
    var remaining = totalFrames

    while remaining > 0 {
      let toRender = min(engine.manualRenderingMaximumFrameCount, remaining)
      let status = (try? engine.renderOffline(toRender, to: scratch)) ?? .error
      if status != .success { break }
      let rendered = Int(scratch.frameLength)
      if rendered == 0 { break }
      if let channel = scratch.floatChannelData {
        let ptr = channel[0]
        for i in 0..<rendered { collected.append(ptr[i]) }
      }
      remaining =
        remaining > AVAudioFrameCount(rendered) ? remaining - AVAudioFrameCount(rendered) : 0
    }

    sampler.stopNote(UInt8(note), onChannel: 0)
    // Flush the release tail so the next note starts clean.
    renderSilence(engine: engine, scratch: scratch, seconds: 0.15)
    return collected
  }

  /// Peak absolute amplitude of a captured buffer — the silence discriminator.
  private func bufferPeak(_ buf: [Float]) -> Float {
    var peak: Float = 0
    for v in buf {
      let a = abs(v)
      if a > peak { peak = a }
    }
    return peak
  }

  func sample(note: Int, tSeconds: Double, durationSeconds: Double) -> Float {
    if tSeconds < 0 || tSeconds >= durationSeconds { return 0 }
    // Reuse the nearest pre-rendered note if outside the captured range.
    let clamped = min(max(note, lowNote), highNote)
    guard let buf = buffers[clamped], !buf.isEmpty else { return 0 }

    let idx = Int(tSeconds * sampleRate)
    if idx >= buf.count { return 0 }
    var value = buf[idx] * gain

    // Short release fade so cutting a held sample at the chord boundary doesn't click.
    let fade = 0.03
    if durationSeconds > fade {
      let releaseStart = durationSeconds - fade
      if tSeconds >= releaseStart {
        let r = Float((durationSeconds - tSeconds) / fade)
        value *= max(0, min(1, r))
      }
    }
    return value
  }

  // MARK: - Diagnostics

  /// Number of MIDI notes that have a pre-rendered PCM buffer.
  var loadedNoteCount: Int { buffers.count }

  /// Peak amplitude bucketed by octave ("oct2"…"oct7", where the key is the MIDI
  /// octave = note / 12). A healthy load has a non-trivial peak in every bucket;
  /// a near-zero bucket pinpoints the dead register. Rounded to 4 dp for logs.
  func peakByOctaveSummary() -> [String: Float] {
    var out: [String: Float] = [:]
    for (note, peak) in peakByNote {
      let key = "oct\(note / 12)"
      out[key] = max(out[key] ?? 0, peak)
    }
    for (key, value) in out {
      out[key] = (value * 10_000).rounded() / 10_000
    }
    return out
  }
}

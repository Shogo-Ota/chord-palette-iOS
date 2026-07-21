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
  /// EP (Rhodes/tine) is brighter; a slightly lower gain avoids harsh sum noise.
  private var gain: Float = 0.6
  /// GM program used for this load (drives EP-specific cleanup).
  private var program: UInt8 = 0

  /// Peak amplitude below which a captured note buffer is treated as "silent"
  /// (i.e. the sampler failed to page the region in before we captured it). A
  /// genuine mezzo-forte note peaks well above 0.05; a truly dead capture sits
  /// at the noise floor (< 1e-4). The threshold is comfortably between the two.
  private let silenceThreshold: Float = 5e-4
  /// How many times to warm-up-and-recapture a note that came back silent
  /// before giving up and recording it in `sampledSilentNotes`.
  private let maxCaptureAttempts = 3

  private let sampleRate: Double
  /// Load-time staging store (built off the audio thread during `load`). NOT read on
  /// the audio thread — see `flat`/`noteStart`/`noteLen` below.
  private var buffers: [Int: [Float]] = [:]

  /// Real-time sample store: every captured note buffer concatenated into ONE flat
  /// `[Float]`, indexed by `noteStart` / `noteLen` (keyed by `note - lowNote`). The
  /// audio-thread `sample()` reads a single element of this stored array — no
  /// dictionary hashing and no `[Float]` copy-on-write retain/release per sample.
  /// That per-sample ARC + hash (44.1 kHz × polyphony) was the sustained-CPU hog
  /// flagged by the `cpu_resource` report; reading a flat array element is ~free.
  private var flat: [Float] = []
  private var noteStart: [Int] = []
  private var noteLen: [Int] = []
  private var loadedNoteCountValue = 0
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
    flat.removeAll(keepingCapacity: false)
    noteStart.removeAll(keepingCapacity: false)
    noteLen.removeAll(keepingCapacity: false)
    loadedNoteCountValue = 0
    silentNotes.removeAll()
    peakByNote.removeAll()
    isLoaded = false
    lastLoadError = nil
    self.program = program
    // Electric pianos are brighter / more chorused in FluidR3 — leave more
    // headroom so polyphony doesn't turn into harsh hash.
    self.gain = Self.isElectricPiano(program) ? 0.48 : 0.6

    let engine = AVAudioEngine()
    let sampler = AVAudioUnitSampler()
    engine.attach(sampler)

    // Capture STEREO then downmix. FluidR3 EP presets bake chorus into the
    // stereo field; forcing mono at the node can phase-cancel into a hissy
    // "noise" bed. Stereo → (L+R)/2 keeps the body and softens that artifact.
    guard let fmt = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2) else {
      lastLoadError = "Could not create stereo AVAudioFormat at \(sampleRate) Hz"
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

    // EP bells ring longer — drain more between notes so the next capture does
    // not inherit a hissy release tail.
    let interNoteDrain = Self.isElectricPiano(program) ? 0.45 : 0.2

    for note in lowNote...highNote {
      var collected = captureNote(
        note, engine: engine, sampler: sampler, scratch: scratch,
        totalFrames: totalFrames, drainSeconds: interNoteDrain)
      collected = cleanBuffer(collected, program: program)
      var peak = bufferPeak(collected)

      // Retry silent captures: an inaudible buffer means the region was still
      // cold. Striking it once has now triggered its load, so an extra warm-up
      // render followed by a fresh capture usually succeeds.
      var attempt = 1
      while peak < silenceThreshold && attempt < maxCaptureAttempts {
        renderSilence(engine: engine, scratch: scratch, seconds: 0.5)
        collected = captureNote(
          note, engine: engine, sampler: sampler, scratch: scratch,
          totalFrames: totalFrames, drainSeconds: interNoteDrain)
        collected = cleanBuffer(collected, program: program)
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
    if isLoaded {
      // Flatten the captured buffers into the real-time store, then drop the
      // dictionary so we don't keep two copies of the (large) sample data.
      buildFlatStore()
      buffers.removeAll(keepingCapacity: false)
    } else {
      lastLoadError = "SoundFont loaded but no note buffers were rendered"
    }
    if isLoaded && !silentNotes.isEmpty {
      // Non-fatal: the sampled voice still loads (low notes are audible), but we
      // record the dead register so the JS diagnostics make the regression
      // obvious instead of it surfacing only as "mid/high chords are silent".
      lastLoadError =
        "Sampled but \(silentNotes.count) note(s) rendered silent: \(silentNotes)"
    }
    return isLoaded
  }

  /// Concatenate the per-note capture buffers into one flat `[Float]` with an
  /// index table, so the audio thread can read a sample without a dictionary
  /// lookup or per-call array retain. Runs off the audio thread (end of `load`).
  private func buildFlatStore() {
    let range = highNote - lowNote + 1
    var starts = [Int](repeating: 0, count: range)
    var lens = [Int](repeating: 0, count: range)
    var total = 0
    for n in lowNote...highNote {
      let len = buffers[n]?.count ?? 0
      starts[n - lowNote] = total
      lens[n - lowNote] = len
      total += len
    }
    var f = [Float]()
    f.reserveCapacity(total)
    for n in lowNote...highNote {
      if let b = buffers[n] { f.append(contentsOf: b) }
    }
    flat = f
    noteStart = starts
    noteLen = lens
    loadedNoteCountValue = buffers.count
  }

  private static func isElectricPiano(_ program: UInt8) -> Bool {
    // GM: 4 = Electric Piano 1, 5 = Electric Piano 2
    return program == 4 || program == 5
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
    renderSilence(engine: engine, scratch: scratch, seconds: 0.5)
  }

  /// Capture a single note's decay into a mono float buffer (stereo downmix).
  private func captureNote(
    _ note: Int, engine: AVAudioEngine, sampler: AVAudioUnitSampler,
    scratch: AVAudioPCMBuffer, totalFrames: AVAudioFrameCount, drainSeconds: Double
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
      if let channels = scratch.floatChannelData {
        let left = channels[0]
        let right = scratch.format.channelCount > 1 ? channels[1] : left
        for i in 0..<rendered {
          collected.append((left[i] + right[i]) * 0.5)
        }
      }
      remaining =
        remaining > AVAudioFrameCount(rendered) ? remaining - AVAudioFrameCount(rendered) : 0
    }

    sampler.stopNote(UInt8(note), onChannel: 0)
    // Flush the release tail so the next note starts clean.
    renderSilence(engine: engine, scratch: scratch, seconds: drainSeconds)
    return collected
  }

  /// Remove capture artifacts that read as "noise" on bright/chorused voices:
  /// DC offset, onset clicks, and (for EP) excess airy tine hiss above ~7 kHz.
  private func cleanBuffer(_ input: [Float], program: UInt8) -> [Float] {
    guard !input.isEmpty else { return input }
    var buf = input

    // DC block: subtract mean so a biased capture doesn't thump every onset.
    var sum: Double = 0
    for v in buf { sum += Double(v) }
    let mean = Float(sum / Double(buf.count))
    if abs(mean) > 1e-6 {
      for i in buf.indices { buf[i] -= mean }
    }

    // Short attack fade (~8 ms) kills sampler page-in clicks.
    let fadeIn = max(1, Int(0.008 * sampleRate))
    let fadeCount = min(fadeIn, buf.count)
    if fadeCount > 1 {
      for i in 0..<fadeCount {
        buf[i] *= Float(i) / Float(fadeCount - 1)
      }
    }

    if Self.isElectricPiano(program) {
      // One-pole low-pass (~7 kHz @ 44.1k) tames the metallic tine/chorus hash
      // that FluidR3 EP bakes in, without dulling the body of the Rhodes tone.
      let cutoffHz = 7_000.0
      let rc = 1.0 / (2.0 * Double.pi * cutoffHz)
      let dt = 1.0 / sampleRate
      let alpha = Float(dt / (rc + dt))
      var prev: Float = 0
      for i in buf.indices {
        prev += alpha * (buf[i] - prev)
        buf[i] = prev
      }
    }

    return buf
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
    let ni = clamped - lowNote
    // Flat-store read: no dictionary lookup / no array retain on the audio thread.
    if ni < 0 || ni >= noteLen.count { return 0 }
    let len = noteLen[ni]
    if len == 0 { return 0 }

    let idx = Int(tSeconds * sampleRate)
    if idx >= len { return 0 }
    var value = flat[noteStart[ni] + idx] * gain

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
  var loadedNoteCount: Int { loadedNoteCountValue }

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

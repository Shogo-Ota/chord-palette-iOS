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

  private let sampleRate: Double
  private var buffers: [Int: [Float]] = [:]
  private let log = OSLog(subsystem: "app.chord-palette.audio", category: "Sampler")

  private(set) var isLoaded = false
  /// Human-readable reason the most recent `load()` failed (or nil on success /
  /// before any attempt). Surfaced to JS via `getAudioDiagnostics` so the root
  /// cause is observable from Metro logs without reading native `os_log`.
  private(set) var lastLoadError: String?

  init(sampleRate: Double) {
    self.sampleRate = sampleRate
  }

  /// Pre-render every note for `program` from `soundFontURL`. Returns false (and
  /// leaves `isLoaded == false`) if the soundfont could not be loaded so the
  /// caller can fall back to the synth provider. Runs off the audio thread.
  func load(soundFontURL: URL, program: UInt8) -> Bool {
    buffers.removeAll()
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

    for note in lowNote...highNote {
      sampler.startNote(UInt8(note), withVelocity: 100, onChannel: 0)
      var collected = [Float]()
      collected.reserveCapacity(Int(totalFrames))
      var remaining = totalFrames

      while remaining > 0 {
        let toRender = min(engine.manualRenderingMaximumFrameCount, remaining)
        let status = (try? engine.renderOffline(toRender, to: scratch)) ?? .error
        if status != .success { break }
        if let channel = scratch.floatChannelData {
          let ptr = channel[0]
          for i in 0..<Int(scratch.frameLength) { collected.append(ptr[i]) }
        }
        remaining -= toRender
      }

      sampler.stopNote(UInt8(note), onChannel: 0)
      // Flush the release tail so the next note starts clean.
      _ = try? engine.renderOffline(
        min(engine.manualRenderingMaximumFrameCount, 2048),
        to: scratch
      )
      buffers[note] = collected
    }

    engine.stop()
    isLoaded = !buffers.isEmpty
    if !isLoaded {
      lastLoadError = "SoundFont loaded but no note buffers were rendered"
    }
    return isLoaded
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
}

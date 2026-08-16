import AVFoundation
import os

/// Sampled drum voice (Phase 2B). Plays the SAME groove hit table as the synth
/// (`DrumKit`), but each voice is a General MIDI percussion one-shot pre-rendered from
/// the bundled SoundFont via `AVAudioUnitSampler`. Uses the same offline pull model as
/// `SampledInstrumentProvider` — every needed drum note is rendered ONCE to a PCM buffer
/// at load time, then the real-time `sample(...)` only reads back and sums buffers (no
/// allocation, no synthesis on the audio thread). `AudioEngineController` falls back to
/// `SynthDrumProvider` when the SoundFont can't be loaded, so drums are never silent.
///
/// Deterministic: the buffers are fixed after load and `sample(...)` is a pure function
/// of the position, so playback and the offline export stay bit-identical.
final class SampledDrumProvider: DrumProvider {
  /// How long each one-shot is captured — long enough for the ride / open-hat decay.
  private let captureSeconds = 1.6
  /// Output headroom before the drum mixer gain (GM kits are hot; leave room to sum).
  private let gain: Float = 0.9
  private let silenceThreshold: Float = 5e-4
  private let maxCaptureAttempts = 3

  private let sampleRate: Double
  /// Voice → pre-rendered mono one-shot. Read-only after `load()` ⇒ audio-thread safe.
  private var buffers: [DrumVoice: [Float]] = [:]
  /// Groove id → pre-resolved hit list (built once so `sample(...)` never allocates).
  private var patterns: [String: [DrumHit]] = [:]
  private var fallback: [DrumHit] = []

  private let log = OSLog(subsystem: "app.chord-palette.audio", category: "SampledDrum")
  private(set) var isLoaded = false
  private(set) var lastLoadError: String?

  /// The distinct voices any groove can use — the set we pre-render.
  private static let voices: [DrumVoice] = [.kick, .snare, .hatClosed, .hatOpen, .ride, .rim, .clap]

  init(sampleRate: Double) {
    self.sampleRate = sampleRate
  }

  /// Pre-render every drum voice from the SoundFont's GM percussion bank. Returns false
  /// (isLoaded == false) if the bank could not be loaded so the caller can fall back to
  /// the synth. Runs off the audio thread (called during `prepare`).
  func load(soundFontURL: URL) -> Bool {
    buffers.removeAll()
    isLoaded = false
    lastLoadError = nil

    // Pre-resolve the groove patterns once (mirrors SynthDrumProvider).
    var p = [String: [DrumHit]]()
    for k in DrumKit.grooveIds { p[k] = DrumKit.hits(for: k) }
    patterns = p
    fallback = p["pop8"] ?? []

    let engine = AVAudioEngine()
    let sampler = AVAudioUnitSampler()
    engine.attach(sampler)

    guard let fmt = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2) else {
      lastLoadError = "Could not create stereo AVAudioFormat at \(sampleRate) Hz"
      return false
    }
    engine.connect(sampler, to: engine.mainMixerNode, format: fmt)

    do {
      try engine.enableManualRenderingMode(.offline, format: fmt, maximumFrameCount: 4096)
      // Percussion bank (MSB 120) → the SoundFont's standard drum kit, so notes
      // 36/38/42/46/51/37 trigger kick/snare/hats/ride/rim on channel 0.
      try sampler.loadSoundBankInstrument(
        at: soundFontURL,
        program: 0,
        bankMSB: UInt8(kAUSampler_DefaultPercussionBankMSB),
        bankLSB: UInt8(kAUSampler_DefaultBankLSB)
      )
      try engine.start()
    } catch {
      lastLoadError = "loadSoundBankInstrument/start (percussion) failed: \(String(describing: error))"
      os_log("SampledDrum load failed: %{public}@", log: log, type: .error, String(describing: error))
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

    // Prime the bank: it pages sample regions in lazily, so the first strike(s) render
    // silent. A second of silence + a warm-up strike across the kit makes the regions
    // resident before the real per-voice capture.
    renderSilence(engine: engine, scratch: scratch, seconds: 1.0)
    warmUp(engine: engine, sampler: sampler, scratch: scratch)

    for voice in Self.voices {
      let note = DrumKit.gmNote(voice)
      var collected = captureNote(note, engine: engine, sampler: sampler, scratch: scratch, totalFrames: totalFrames)
      collected = cleanBuffer(collected)
      var peak = bufferPeak(collected)
      var attempt = 1
      while peak < silenceThreshold && attempt < maxCaptureAttempts {
        renderSilence(engine: engine, scratch: scratch, seconds: 0.4)
        collected = captureNote(note, engine: engine, sampler: sampler, scratch: scratch, totalFrames: totalFrames)
        collected = cleanBuffer(collected)
        peak = bufferPeak(collected)
        attempt += 1
      }
      if peak >= silenceThreshold {
        buffers[voice] = collected
      } else {
        os_log("SampledDrum voice note %d still silent after %d attempts", log: log, type: .error, Int(note), attempt)
      }
    }

    engine.stop()
    isLoaded = !buffers.isEmpty
    if !isLoaded { lastLoadError = "Percussion bank loaded but no voice buffers rendered" }
    return isLoaded
  }

  func sample(
    groove: String, beatInBar: Double, secondsPerBeat: Double, beatsPerBar: Double, frame: Int64,
    drumMode: String = "full"
  ) -> Float {
    let hits = patterns[groove] ?? fallback
    let barLen = max(beatsPerBar, 0.001)
    var out: Float = 0
    for hit in hits {
      if !DrumKit.voiceAllowed(hit.voice, drumMode: drumMode) { continue }
      guard let buf = buffers[hit.voice], !buf.isEmpty else { continue }
      var dt = beatInBar - hit.beat
      if dt < 0 { dt += barLen } // tail carried from the previous bar
      let idx = Int(dt * secondsPerBeat * sampleRate)
      if idx >= 0 && idx < buf.count {
        out += buf[idx] * hit.vel
      }
    }
    return out * gain
  }

  // MARK: - Offline capture helpers (mirror SampledInstrumentProvider)

  private func renderSilence(engine: AVAudioEngine, scratch: AVAudioPCMBuffer, seconds: Double) {
    var remaining = AVAudioFrameCount(max(0, seconds) * sampleRate)
    while remaining > 0 {
      let toRender = min(engine.manualRenderingMaximumFrameCount, remaining)
      let status = (try? engine.renderOffline(toRender, to: scratch)) ?? .error
      if status != .success { break }
      let rendered = AVAudioFrameCount(scratch.frameLength)
      if rendered == 0 { break }
      remaining = remaining > rendered ? remaining - rendered : 0
    }
  }

  private func warmUp(engine: AVAudioEngine, sampler: AVAudioUnitSampler, scratch: AVAudioPCMBuffer) {
    for voice in Self.voices { sampler.startNote(DrumKit.gmNote(voice), withVelocity: 100, onChannel: 0) }
    renderSilence(engine: engine, scratch: scratch, seconds: 0.5)
    for voice in Self.voices { sampler.stopNote(DrumKit.gmNote(voice), onChannel: 0) }
    renderSilence(engine: engine, scratch: scratch, seconds: 0.5)
  }

  private func captureNote(
    _ note: UInt8, engine: AVAudioEngine, sampler: AVAudioUnitSampler,
    scratch: AVAudioPCMBuffer, totalFrames: AVAudioFrameCount
  ) -> [Float] {
    sampler.startNote(note, withVelocity: 110, onChannel: 0)
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
        for i in 0..<rendered { collected.append((left[i] + right[i]) * 0.5) }
      }
      remaining = remaining > AVAudioFrameCount(rendered) ? remaining - AVAudioFrameCount(rendered) : 0
    }
    // Drums are one-shots: release immediately so the next capture starts clean.
    sampler.stopNote(note, onChannel: 0)
    renderSilence(engine: engine, scratch: scratch, seconds: 0.15)
    return collected
  }

  /// DC-block + short attack fade to kill sampler page-in clicks (no EP low-pass here).
  private func cleanBuffer(_ input: [Float]) -> [Float] {
    guard !input.isEmpty else { return input }
    var buf = input
    var sum: Double = 0
    for v in buf { sum += Double(v) }
    let mean = Float(sum / Double(buf.count))
    if abs(mean) > 1e-6 { for i in buf.indices { buf[i] -= mean } }
    let fade = min(max(1, Int(0.004 * sampleRate)), buf.count)
    if fade > 1 { for i in 0..<fade { buf[i] *= Float(i) / Float(fade - 1) } }
    return buf
  }

  private func bufferPeak(_ buf: [Float]) -> Float {
    var peak: Float = 0
    for v in buf { let a = abs(v); if a > peak { peak = a } }
    return peak
  }
}

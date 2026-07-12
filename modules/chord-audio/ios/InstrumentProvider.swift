import Foundation

/// Abstraction over "how a chord note sounds". Phase 2A ships a synth-only
/// implementation; Phase 2B swaps in a sampled/`AVAudioUnitSampler`-backed
/// provider WITHOUT touching the engine, mixer, or scheduler (sprint-2.md §10).
///
/// The provider is intentionally decoupled from AVAudioEngine: it only maps
/// (note, time-since-onset) → a raw sample in [-1, 1]. Voicing, scheduling and
/// mixing live in `AudioEngineController` / `Mixer` / `Scheduler`.
protocol InstrumentProvider: AnyObject {
  /// Amplitude sample in [-1, 1] for `note` at `tSeconds` after its onset,
  /// where the note is held for `durationSeconds`. Returns 0 once released.
  func sample(note: Int, tSeconds: Double, durationSeconds: Double) -> Float
}

/// VERIFICATION-ONLY synth (Phase 2A). NOT production quality — it exists purely
/// to validate the Expo Custom Native Module → EAS Dev Build → AVAudioEngine →
/// synchronized playback → loop path. Do NOT ship this as a real instrument;
/// Phase 2B replaces it via `InstrumentProvider` with licensed multisamples.
final class SynthInstrumentProvider: InstrumentProvider {
  // Simple linear AD(S)R envelope, in seconds.
  private let attack: Double = 0.008
  private let release: Double = 0.06
  private let sustainLevel: Float = 0.9

  func sample(note: Int, tSeconds: Double, durationSeconds: Double) -> Float {
    if tSeconds < 0 || tSeconds >= durationSeconds {
      return 0
    }
    let freq = Scheduler.frequency(forMidi: note)
    // Sine partial + a soft octave to avoid a totally naked tone (still simple).
    let phase = 2.0 * Double.pi * freq * tSeconds
    let tone = sin(phase) + 0.25 * sin(2.0 * phase)
    let env = envelope(tSeconds: tSeconds, durationSeconds: durationSeconds)
    // 0.28 keeps 4-note polyphony well under clipping before the mixer gain.
    return Float(tone) * env * 0.28
  }

  private func envelope(tSeconds: Double, durationSeconds: Double) -> Float {
    let releaseStart = max(attack, durationSeconds - release)
    if tSeconds < attack {
      return Float(tSeconds / attack) * sustainLevel
    }
    if tSeconds >= releaseStart {
      let r = (durationSeconds - tSeconds) / release
      return Float(max(0.0, min(1.0, r))) * sustainLevel
    }
    return sustainLevel
  }
}

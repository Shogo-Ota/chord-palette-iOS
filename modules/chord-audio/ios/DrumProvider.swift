import Foundation

/// Abstraction over the drum voice. Phase 2A ships a synth-only, single-pattern
/// implementation ("pop8-min"); Phase 2B swaps in sampled one-shots via this
/// protocol without touching the engine/mixer/scheduler (sprint-2.md §10).
protocol DrumProvider: AnyObject {
  /// Sample in [-1, 1] for the given position within a 4/4 bar.
  /// `frame` is the absolute sample index, used only as a stateless noise seed.
  func sample(beatInBar: Double, secondsPerBeat: Double, frame: Int64) -> Float
}

/// VERIFICATION-ONLY synth drums (Phase 2A). NOT production quality — validates
/// chord/drum synchronization and looping only. Phase 2B replaces this with
/// licensed one-shot samples via `DrumProvider`.
final class SynthDrumProvider: DrumProvider {
  private enum Voice { case kick, snare, hat }
  private struct Hit { let beat: Double; let voice: Voice }

  /// Minimal Pop 8-beat: kick 1&3, snare 2&4, hats on every 8th.
  private let pattern: [Hit] = [
    Hit(beat: 0.0, voice: .kick),
    Hit(beat: 2.0, voice: .kick),
    Hit(beat: 1.0, voice: .snare),
    Hit(beat: 3.0, voice: .snare),
    Hit(beat: 0.0, voice: .hat),
    Hit(beat: 0.5, voice: .hat),
    Hit(beat: 1.0, voice: .hat),
    Hit(beat: 1.5, voice: .hat),
    Hit(beat: 2.0, voice: .hat),
    Hit(beat: 2.5, voice: .hat),
    Hit(beat: 3.0, voice: .hat),
    Hit(beat: 3.5, voice: .hat),
  ]

  func sample(beatInBar: Double, secondsPerBeat: Double, frame: Int64) -> Float {
    var out: Float = 0
    for hit in pattern {
      var dt = beatInBar - hit.beat
      if dt < 0 { dt += 4.0 } // tail carried from the previous bar
      let t = dt * secondsPerBeat
      out += voiceSample(hit.voice, t: t, frame: frame)
    }
    // Headroom before the drum mixer gain.
    return out * 0.6
  }

  private func voiceSample(_ voice: Voice, t: Double, frame: Int64) -> Float {
    switch voice {
    case .kick:
      let decay = 0.18
      if t >= decay { return 0 }
      let env = exp(-t / 0.05)
      let freq = 120.0 * exp(-t / 0.03) + 45.0 // quick pitch drop
      return Float(sin(2.0 * Double.pi * freq * t) * env) * 0.9
    case .snare:
      let decay = 0.14
      if t >= decay { return 0 }
      let env = exp(-t / 0.05)
      let tone = sin(2.0 * Double.pi * 180.0 * t) * 0.3
      let noise = Double(SynthDrumProvider.noise(frame)) * 0.7
      return Float((tone + noise) * env) * 0.5
    case .hat:
      let decay = 0.05
      if t >= decay { return 0 }
      let env = exp(-t / 0.015)
      let noise = Double(SynthDrumProvider.noise(frame))
      return Float(noise * env) * 0.25
    }
  }

  /// Stateless pseudo-noise in [-1, 1] seeded by the absolute frame index.
  private static func noise(_ frame: Int64) -> Float {
    var x = UInt64(bitPattern: frame) &* 0x9E37_79B9_7F4A_7C15
    x ^= x >> 30
    x = x &* 0xBF58_476D_1CE4_E5B9
    x ^= x >> 27
    let normalized = Double(x >> 11) / Double(1 << 53) // [0,1)
    return Float(normalized * 2.0 - 1.0)
  }
}

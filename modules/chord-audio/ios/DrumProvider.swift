import Foundation

/// Abstraction over the drum voice. The concrete groove is chosen per render call
/// from the (immutable) plan snapshot, so there is no shared mutable state on the
/// audio thread. Phase-2 ships synth one-shots differentiated into 7 grooves; a
/// future phase can swap in sampled hits behind this same protocol (sprint-2.md §10).
protocol DrumProvider: AnyObject {
  /// Sample in [-1, 1] for the given position within a 4/4 bar, for `groove`.
  /// `frame` is the absolute sample index, used only as a stateless noise seed.
  func sample(groove: String, beatInBar: Double, secondsPerBeat: Double, frame: Int64) -> Float
}

/// Synth (808-style) drum voices arranged into the 6 MVP grooves (requirements
/// §5.6): pop8 / pop16 / rock8 / rock16 / soul16 / bossaNova.
/// Not sampled, but each groove uses distinct voices and velocities so the character
/// is clearly audible and stays in sync. The rhythm (which voice, when) comes from the
/// shared `DrumKit`; this class only owns how a voice SOUNDS (oscillator/noise
/// synthesis in `voiceSample`).
final class SynthDrumProvider: DrumProvider {
  /// Groove id → pre-resolved hit list. Built ONCE at init so the real-time
  /// `sample(...)` never allocates (rebuilding the pattern per sample was starving
  /// the audio render callback). Read-only after init ⇒ safe to read on the audio
  /// thread without a lock.
  private let patterns: [String: [DrumHit]]
  private let fallback: [DrumHit]

  init() {
    var p = [String: [DrumHit]]()
    for k in DrumKit.grooveIds { p[k] = DrumKit.hits(for: k) }
    patterns = p
    fallback = p["pop8"] ?? []
  }

  func sample(groove: String, beatInBar: Double, secondsPerBeat: Double, frame: Int64) -> Float {
    let hits = patterns[groove] ?? fallback
    var out: Float = 0
    for hit in hits {
      var dt = beatInBar - hit.beat
      if dt < 0 { dt += 4.0 } // tail carried from the previous bar
      let t = dt * secondsPerBeat
      out += voiceSample(hit.voice, t: t, frame: frame) * hit.vel
    }
    // Headroom before the drum mixer gain.
    return out * 0.6
  }

  // MARK: - Voice synthesis

  private func voiceSample(_ voice: DrumVoice, t: Double, frame: Int64) -> Float {
    switch voice {
    case .kick:
      // Body: pitched sine drop. Attack click (audit P1-1) restores presence on
      // iPhone speakers where the sub body alone disappears.
      let decay = 0.18
      if t >= decay { return 0 }
      let env = exp(-t / 0.05)
      let freq = 120.0 * exp(-t / 0.03) + 45.0
      let body = sin(2.0 * Double.pi * freq * t) * env
      let clickEnv = exp(-t / 0.0035) // ~3–8ms attack
      let click =
        sin(2.0 * Double.pi * 2400.0 * t) * clickEnv * 0.55
        + Double(SynthDrumProvider.noise(frame)) * clickEnv * 0.3
      return Float(body * 0.85 + click) * 0.95
    case .snare:
      // Audit P1-2: less full-band noise, more mid tone so the snare reads on
      // small speakers without a thin/harsh hash.
      let decay = 0.14
      if t >= decay { return 0 }
      let env = exp(-t / 0.05)
      let tone =
        sin(2.0 * Double.pi * 180.0 * t) * 0.4
        + sin(2.0 * Double.pi * 330.0 * t) * 0.18
      let noise = Double(SynthDrumProvider.noise(frame)) * 0.42
      return Float((tone + noise) * env) * 0.55
    case .hatClosed:
      let decay = 0.05
      if t >= decay { return 0 }
      let env = exp(-t / 0.015)
      let noise = Double(SynthDrumProvider.noise(frame))
      return Float(noise * env) * 0.25
    case .hatOpen:
      let decay = 0.32
      if t >= decay { return 0 }
      let env = exp(-t / 0.11)
      let noise = Double(SynthDrumProvider.noise(frame))
      return Float(noise * env) * 0.2
    case .ride:
      // Metallic ping: a couple of inharmonic partials + a touch of noise shimmer.
      let decay = 0.45
      if t >= decay { return 0 }
      let env = exp(-t / 0.16)
      let ping = sin(2.0 * Double.pi * 3200.0 * t) * 0.5 + sin(2.0 * Double.pi * 5300.0 * t) * 0.3
      let shimmer = Double(SynthDrumProvider.noise(frame)) * 0.2
      return Float((ping + shimmer) * env) * 0.22
    case .rim:
      // Cross-stick: very short bright click + short tone.
      let decay = 0.03
      if t >= decay { return 0 }
      let env = exp(-t / 0.006)
      let tone = sin(2.0 * Double.pi * 1700.0 * t)
      return Float(tone * env) * 0.5
    case .clap:
      // Hand clap: a few band-passed noise bursts a couple ms apart (the classic
      // 808-style multi-tap) followed by a short diffuse tail. Mid-forward so it
      // reads clearly on small speakers without the harsh full-band hash.
      let decay = 0.2
      if t >= decay { return 0 }
      // Three quick taps then a body tail — spacing gives the characteristic "clap".
      let taps = [0.0, 0.009, 0.018]
      var bursts: Double = 0
      for (i, tap) in taps.enumerated() {
        let dt = t - tap
        if dt < 0 { continue }
        let env = exp(-dt / 0.0045)
        bursts += Double(SynthDrumProvider.noise(frame &+ Int64(i * 7919))) * env
      }
      let tailEnv = exp(-t / 0.055)
      let tail = Double(SynthDrumProvider.noise(frame)) * tailEnv * 0.5
      // Gentle mid tone shapes the noise toward a hand-clap timbre (~1.1 kHz).
      let shape = 0.6 + 0.4 * sin(2.0 * Double.pi * 1100.0 * t)
      return Float((bursts + tail) * shape) * 0.42
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

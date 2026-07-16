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

/// Synth (808-style) drum voices arranged into the 7 MVP grooves (requirements
/// §5.6): pop8 / pop16 / rock8 / rock16 / soul16 / jazzSwing / bossaNova.
/// Not sampled, but each groove uses distinct voices, velocities and (for jazz)
/// triplet swing so the character is clearly audible and stays in sync.
final class SynthDrumProvider: DrumProvider {
  private enum Voice { case kick, snare, hatClosed, hatOpen, ride, rim }
  private struct Hit { let beat: Double; let voice: Voice; let vel: Float }

  /// Groove id → pre-resolved hit list. Built ONCE at init so the real-time
  /// `sample(...)` never allocates (rebuilding the pattern per sample was starving
  /// the audio render callback). Read-only after init ⇒ safe to read on the audio
  /// thread without a lock.
  private let patterns: [String: [Hit]]
  private let fallback: [Hit]

  init() {
    let keys = ["pop8", "pop8-min", "pop16", "rock8", "rock16", "soul16", "jazzSwing", "bossaNova"]
    var p = [String: [Hit]]()
    for k in keys { p[k] = Self.pattern(for: k) }
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

  // MARK: - Groove patterns (1 bar / 4 beats)

  /// Straight hats every `step` beats, accented on the downbeats.
  private static func hats(_ voice: Voice, step: Double, vel: Float, accent: Float) -> [Hit] {
    var out = [Hit]()
    var b = 0.0
    while b < 4.0 - 1e-9 {
      let onDownbeat = abs(b.rounded() - b) < 1e-9
      out.append(Hit(beat: b, voice: voice, vel: onDownbeat ? accent : vel))
      b += step
    }
    return out
  }

  private static func pattern(for groove: String) -> [Hit] {
    switch groove {
    case "pop8", "pop8-min":
      return [
        Hit(beat: 0, voice: .kick, vel: 0.9), Hit(beat: 2, voice: .kick, vel: 0.85),
        Hit(beat: 1, voice: .snare, vel: 0.9), Hit(beat: 3, voice: .snare, vel: 0.9),
      ] + hats(.hatClosed, step: 0.5, vel: 0.45, accent: 0.6)

    case "pop16":
      return [
        Hit(beat: 0, voice: .kick, vel: 0.9), Hit(beat: 2, voice: .kick, vel: 0.85),
        Hit(beat: 2.5, voice: .kick, vel: 0.5),
        Hit(beat: 1, voice: .snare, vel: 0.9), Hit(beat: 3, voice: .snare, vel: 0.9),
      ] + hats(.hatClosed, step: 0.25, vel: 0.4, accent: 0.58)

    case "rock8":
      return [
        Hit(beat: 0, voice: .kick, vel: 1.0), Hit(beat: 2, voice: .kick, vel: 0.95),
        Hit(beat: 1, voice: .snare, vel: 0.98), Hit(beat: 3, voice: .snare, vel: 0.98),
      ] + hats(.hatClosed, step: 0.5, vel: 0.6, accent: 0.72)

    case "rock16":
      return [
        Hit(beat: 0, voice: .kick, vel: 1.0), Hit(beat: 1.5, voice: .kick, vel: 0.7),
        Hit(beat: 2, voice: .kick, vel: 0.95),
        Hit(beat: 1, voice: .snare, vel: 0.98), Hit(beat: 3, voice: .snare, vel: 0.98),
      ] + hats(.hatClosed, step: 0.25, vel: 0.52, accent: 0.66)

    case "soul16":
      // Backbeat + syncopated kick + ghost-note snares for a soulful pocket.
      return [
        Hit(beat: 0, voice: .kick, vel: 0.9), Hit(beat: 2.5, voice: .kick, vel: 0.72),
        Hit(beat: 1, voice: .snare, vel: 0.95), Hit(beat: 3, voice: .snare, vel: 0.95),
        Hit(beat: 1.75, voice: .snare, vel: 0.3), Hit(beat: 3.75, voice: .snare, vel: 0.3),
      ] + hats(.hatClosed, step: 0.25, vel: 0.4, accent: 0.55)

    case "jazzSwing":
      // Classic swing ride (triplet feel: off-beats at 2/3), hi-hat on 2 & 4,
      // feathered kick. Ride is the character voice.
      return [
        Hit(beat: 0, voice: .ride, vel: 0.7),
        Hit(beat: 1, voice: .ride, vel: 0.66), Hit(beat: 1.0 + 2.0 / 3.0, voice: .ride, vel: 0.5),
        Hit(beat: 2, voice: .ride, vel: 0.7),
        Hit(beat: 3, voice: .ride, vel: 0.66), Hit(beat: 3.0 + 2.0 / 3.0, voice: .ride, vel: 0.5),
        Hit(beat: 1, voice: .hatOpen, vel: 0.4), Hit(beat: 3, voice: .hatOpen, vel: 0.4),
        Hit(beat: 0, voice: .kick, vel: 0.22), Hit(beat: 1, voice: .kick, vel: 0.2),
        Hit(beat: 2, voice: .kick, vel: 0.22), Hit(beat: 3, voice: .kick, vel: 0.2),
      ]

    case "bossaNova":
      // Surdo-style kick, cross-stick (rim) clave, straight 8th hats.
      return [
        Hit(beat: 0, voice: .kick, vel: 0.72), Hit(beat: 1.5, voice: .kick, vel: 0.6),
        Hit(beat: 2, voice: .kick, vel: 0.72), Hit(beat: 3.5, voice: .kick, vel: 0.6),
        Hit(beat: 0, voice: .rim, vel: 0.72), Hit(beat: 1.5, voice: .rim, vel: 0.62),
        Hit(beat: 2.5, voice: .rim, vel: 0.66), Hit(beat: 3, voice: .rim, vel: 0.6),
      ] + hats(.hatClosed, step: 0.5, vel: 0.32, accent: 0.42)

    default:
      // Unknown id → safe default (Pop 8beat).
      return pattern(for: "pop8")
    }
  }

  // MARK: - Voice synthesis

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

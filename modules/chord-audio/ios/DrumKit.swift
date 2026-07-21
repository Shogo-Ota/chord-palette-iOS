import Foundation

/// The drum voices used across the 7 MVP grooves (requirements §5.6). Shared by every
/// `DrumProvider`: the synth turns a voice into oscillator math, the sampled provider
/// maps it to a General MIDI percussion note. Plain enum ⇒ Hashable (usable as a key).
enum DrumVoice { case kick, snare, hatClosed, hatOpen, ride, rim }

/// One drum onset within a 4/4 bar. `beat` is its position (0..4), `vel` a 0..1 level.
struct DrumHit { let beat: Double; let voice: DrumVoice; let vel: Float }

/// Groove id → 1-bar hit list: the SINGLE source of truth for the drum rhythm, shared
/// by the synth and sampled providers so they can never drift apart. Providers differ
/// only in how a voice SOUNDS (synth vs sampled), never in WHEN it plays.
///
/// The kick/snare beats here mirror the JS-side `src/lib/performance/groove/drumProfiles.ts`
/// that drives the piano groove-lock — keep the two in sync.
enum DrumKit {
  /// All groove ids the providers pre-resolve at init. `pop8-min` is a pop8 alias.
  static let grooveIds = ["pop8", "pop8-min", "pop16", "rock8", "rock16", "soul16", "bossaNova"]

  /// Straight hats every `step` beats, with heel-toe dynamics (audit P2-1):
  /// integer beats get `accent`; 8th offbeats are softer; 16th e/a softer still.
  private static func hats(_ voice: DrumVoice, step: Double, vel: Float, accent: Float) -> [DrumHit] {
    var out = [DrumHit]()
    var b = 0.0
    while b < 4.0 - 1e-9 {
      let slot = Int((b * 4.0).rounded()) % 4 // 0=↓ 1=e 2=& 3=a
      let hitVel: Float
      if slot == 0 {
        hitVel = accent
      } else if slot == 2 {
        hitVel = vel * 0.72
      } else {
        hitVel = vel * 0.55
      }
      out.append(DrumHit(beat: b, voice: voice, vel: hitVel))
      b += step
    }
    return out
  }

  /// The 1-bar hit list for a groove (identical layout to the legacy synth patterns).
  static func hits(for groove: String) -> [DrumHit] {
    switch groove {
    case "pop8", "pop8-min":
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.9), DrumHit(beat: 2, voice: .kick, vel: 0.85),
        DrumHit(beat: 1, voice: .snare, vel: 0.9), DrumHit(beat: 3, voice: .snare, vel: 0.9),
      ] + hats(.hatClosed, step: 0.5, vel: 0.45, accent: 0.6)

    case "pop16":
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.9), DrumHit(beat: 2, voice: .kick, vel: 0.85),
        DrumHit(beat: 2.5, voice: .kick, vel: 0.5),
        DrumHit(beat: 1, voice: .snare, vel: 0.9), DrumHit(beat: 3, voice: .snare, vel: 0.9),
      ] + hats(.hatClosed, step: 0.25, vel: 0.4, accent: 0.58)

    case "rock8":
      return [
        DrumHit(beat: 0, voice: .kick, vel: 1.0), DrumHit(beat: 2, voice: .kick, vel: 0.95),
        DrumHit(beat: 1, voice: .snare, vel: 0.98), DrumHit(beat: 3, voice: .snare, vel: 0.98),
      ] + hats(.hatClosed, step: 0.5, vel: 0.6, accent: 0.72)

    case "rock16":
      return [
        DrumHit(beat: 0, voice: .kick, vel: 1.0), DrumHit(beat: 1.5, voice: .kick, vel: 0.7),
        DrumHit(beat: 2, voice: .kick, vel: 0.95),
        DrumHit(beat: 1, voice: .snare, vel: 0.98), DrumHit(beat: 3, voice: .snare, vel: 0.98),
      ] + hats(.hatClosed, step: 0.25, vel: 0.52, accent: 0.66)

    case "soul16":
      // Backbeat + syncopated kick + ghost-note snares for a soulful pocket.
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.9), DrumHit(beat: 2.5, voice: .kick, vel: 0.72),
        DrumHit(beat: 1, voice: .snare, vel: 0.95), DrumHit(beat: 3, voice: .snare, vel: 0.95),
        DrumHit(beat: 1.75, voice: .snare, vel: 0.3), DrumHit(beat: 3.75, voice: .snare, vel: 0.3),
      ] + hats(.hatClosed, step: 0.25, vel: 0.4, accent: 0.55)

    case "bossaNova":
      // Surdo-style kick, cross-stick (rim) clave, straight 8th hats.
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.72), DrumHit(beat: 1.5, voice: .kick, vel: 0.6),
        DrumHit(beat: 2, voice: .kick, vel: 0.72), DrumHit(beat: 3.5, voice: .kick, vel: 0.6),
        DrumHit(beat: 0, voice: .rim, vel: 0.72), DrumHit(beat: 1.5, voice: .rim, vel: 0.62),
        DrumHit(beat: 2.5, voice: .rim, vel: 0.66), DrumHit(beat: 3, voice: .rim, vel: 0.6),
      ] + hats(.hatClosed, step: 0.5, vel: 0.32, accent: 0.42)

    default:
      // Unknown id → safe default (Pop 8beat).
      return hits(for: "pop8")
    }
  }

  /// General MIDI percussion note (bank MSB 120 "standard kit") for a voice. Used by
  /// the sampled provider to trigger the right one-shot from the SoundFont's drum bank.
  static func gmNote(_ voice: DrumVoice) -> UInt8 {
    switch voice {
    case .kick: return 36 // Bass Drum 1
    case .snare: return 38 // Acoustic Snare
    case .hatClosed: return 42 // Closed Hi-Hat
    case .hatOpen: return 46 // Open Hi-Hat
    case .ride: return 51 // Ride Cymbal 1
    case .rim: return 37 // Side Stick / cross-stick
    }
  }
}

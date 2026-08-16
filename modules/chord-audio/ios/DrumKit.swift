import Foundation

/// The drum voices used across the MVP grooves (requirements §5.6). Shared by every
/// `DrumProvider`: the synth turns a voice into oscillator math, the sampled provider
/// maps it to a General MIDI percussion note. Plain enum ⇒ Hashable (usable as a key).
enum DrumVoice { case kick, snare, hatClosed, hatOpen, ride, rim, clap }

/// One drum onset within a bar. `beat` is its position within [0, barLength); `vel`
/// is a 0..1 level. Hit beats must stay within [0, barLength).
struct DrumHit { let beat: Double; let voice: DrumVoice; let vel: Float }

/// Groove id → 1-bar hit list: the SINGLE source of truth for the drum rhythm, shared
/// by the synth and sampled providers so they can never drift apart. Providers differ
/// only in how a voice SOUNDS (synth vs sampled), never in WHEN it plays.
///
/// The kick/snare beats here mirror the JS-side `src/lib/performance/groove/drumProfiles.ts`
/// that drives the piano groove-lock — keep the two in sync.
enum DrumKit {
  /// All groove ids the providers pre-resolve at init. `pop8-min` is a pop8 alias.
  static let grooveIds = [
    "pop8", "pop8-min", "pop16", "rock8", "rock16", "soul16", "clap", "bossaNova",
    "shuffle", "swing", "reggae", "sixEight", "waltz", "beat4",
  ]

  /// Straight hats every `step` beats, with heel-toe dynamics (audit P2-1):
  /// integer beats get `accent`; 8th offbeats are softer; 16th e/a softer still.
  /// Hit beats must stay within [0, barLength).
  private static func hats(
    _ voice: DrumVoice, step: Double, vel: Float, accent: Float, barLength: Double = 4.0
  ) -> [DrumHit] {
    var out = [DrumHit]()
    var b = 0.0
    while b < barLength - 1e-9 {
      let slot = Int((b * 4.0).rounded()) % 4 // 0=↓ 1=e 2=& 3=a (4/4 grid feel)
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

  /// Swung closed-hat (or ride) pattern: each beat head plus a triplet hop at beat + 2/3.
  /// Hit beats must stay within [0, barLength).
  private static func swungHats(
    _ voice: DrumVoice, barLength: Double = 4.0, vel: Float, accent: Float
  ) -> [DrumHit] {
    var out = [DrumHit]()
    var beat = 0.0
    while beat < barLength - 1e-9 {
      out.append(DrumHit(beat: beat, voice: voice, vel: accent))
      let off = beat + (2.0 / 3.0)
      if off < barLength - 1e-9 {
        out.append(DrumHit(beat: off, voice: voice, vel: vel))
      }
      beat += 1.0
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
      ] + hats(.hatClosed, step: 0.5, vel: 0.45, accent: 0.6, barLength: 4.0)

    case "beat4":
      // Quarter-note kit: one kick on the downbeat, backbeat snare, quarter hats.
      // In `kick` mode this leaves a single hit per bar — the sparsest reading.
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.9),
        DrumHit(beat: 1, voice: .snare, vel: 0.9), DrumHit(beat: 3, voice: .snare, vel: 0.9),
      ] + hats(.hatClosed, step: 1.0, vel: 0.44, accent: 0.58, barLength: 4.0)

    case "pop16":
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.9), DrumHit(beat: 2, voice: .kick, vel: 0.85),
        DrumHit(beat: 2.5, voice: .kick, vel: 0.5),
        DrumHit(beat: 1, voice: .snare, vel: 0.9), DrumHit(beat: 3, voice: .snare, vel: 0.9),
      ] + hats(.hatClosed, step: 0.25, vel: 0.4, accent: 0.58, barLength: 4.0)

    case "rock8":
      return [
        DrumHit(beat: 0, voice: .kick, vel: 1.0), DrumHit(beat: 2, voice: .kick, vel: 0.95),
        DrumHit(beat: 1, voice: .snare, vel: 0.98), DrumHit(beat: 3, voice: .snare, vel: 0.98),
      ] + hats(.hatClosed, step: 0.5, vel: 0.6, accent: 0.72, barLength: 4.0)

    case "rock16":
      return [
        DrumHit(beat: 0, voice: .kick, vel: 1.0), DrumHit(beat: 1.5, voice: .kick, vel: 0.7),
        DrumHit(beat: 2, voice: .kick, vel: 0.95),
        DrumHit(beat: 1, voice: .snare, vel: 0.98), DrumHit(beat: 3, voice: .snare, vel: 0.98),
      ] + hats(.hatClosed, step: 0.25, vel: 0.52, accent: 0.66, barLength: 4.0)

    case "soul16":
      // Backbeat + syncopated kick + ghost-note snares for a soulful pocket.
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.9), DrumHit(beat: 2.5, voice: .kick, vel: 0.72),
        DrumHit(beat: 1, voice: .snare, vel: 0.95), DrumHit(beat: 3, voice: .snare, vel: 0.95),
        DrumHit(beat: 1.75, voice: .snare, vel: 0.3), DrumHit(beat: 3.75, voice: .snare, vel: 0.3),
      ] + hats(.hatClosed, step: 0.25, vel: 0.4, accent: 0.55, barLength: 4.0)

    case "clap":
      // Hand-claps ONLY, on the backbeat (beats 2 & 4). No kick / snare / hats —
      // a pure clap track, as requested.
      return [
        DrumHit(beat: 1, voice: .clap, vel: 1.0),
        DrumHit(beat: 3, voice: .clap, vel: 1.0),
      ]

    case "bossaNova":
      // Surdo-style kick, cross-stick (rim) clave, straight 8th hats.
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.72), DrumHit(beat: 1.5, voice: .kick, vel: 0.6),
        DrumHit(beat: 2, voice: .kick, vel: 0.72), DrumHit(beat: 3.5, voice: .kick, vel: 0.6),
        DrumHit(beat: 0, voice: .rim, vel: 0.72), DrumHit(beat: 1.5, voice: .rim, vel: 0.62),
        DrumHit(beat: 2.5, voice: .rim, vel: 0.66), DrumHit(beat: 3, voice: .rim, vel: 0.6),
      ] + hats(.hatClosed, step: 0.5, vel: 0.32, accent: 0.42, barLength: 4.0)

    case "shuffle":
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.9), DrumHit(beat: 2, voice: .kick, vel: 0.85),
        DrumHit(beat: 1, voice: .snare, vel: 0.9), DrumHit(beat: 3, voice: .snare, vel: 0.9),
      ] + swungHats(.hatClosed, barLength: 4.0, vel: 0.42, accent: 0.58)

    case "swing":
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.9), DrumHit(beat: 2, voice: .kick, vel: 0.85),
        DrumHit(beat: 1, voice: .snare, vel: 0.9), DrumHit(beat: 3, voice: .snare, vel: 0.9),
      ] + swungHats(.ride, barLength: 4.0, vel: 0.38, accent: 0.52)

    case "reggae":
      // One-drop kick + rim skank on the offbeats + light hat chatter.
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.82), DrumHit(beat: 2, voice: .kick, vel: 0.78),
        DrumHit(beat: 1, voice: .rim, vel: 0.88), DrumHit(beat: 3, voice: .rim, vel: 0.88),
        DrumHit(beat: 0.5, voice: .hatClosed, vel: 0.28),
        DrumHit(beat: 1.5, voice: .hatClosed, vel: 0.26),
        DrumHit(beat: 2.5, voice: .hatClosed, vel: 0.28),
        DrumHit(beat: 3.5, voice: .hatClosed, vel: 0.26),
      ]

    case "sixEight":
      // 6/8 bar: kick on 0 & 3, soft snare on 3, straight quarter hats.
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.9), DrumHit(beat: 3, voice: .kick, vel: 0.82),
        DrumHit(beat: 3, voice: .snare, vel: 0.55),
      ] + hats(.hatClosed, step: 1.0, vel: 0.38, accent: 0.48, barLength: 6.0)

    case "waltz":
      // 3/4 bar: kick on 1, soft snare + hat on 2 & 3.
      return [
        DrumHit(beat: 0, voice: .kick, vel: 0.88),
        DrumHit(beat: 1, voice: .snare, vel: 0.52), DrumHit(beat: 2, voice: .snare, vel: 0.48),
        DrumHit(beat: 1, voice: .hatClosed, vel: 0.36), DrumHit(beat: 2, voice: .hatClosed, vel: 0.32),
      ]

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
    case .clap: return 39 // Hand Clap
    }
  }

  /// Which voices a playback mode is allowed to trigger.
  /// `kick` is the old sparse mode and is treated as clap.
  static func voiceAllowed(_ voice: DrumVoice, drumMode: String) -> Bool {
    switch drumMode {
    case "off":
      return false
    case "clap", "kick":
      return voice == .clap
    default:
      return true
    }
  }
}

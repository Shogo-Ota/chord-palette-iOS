import CoreGraphics

/// How strongly an advanced-harmony chord's extra light reads at one instant.
///
/// Three phases, all driven by values Flow already computes, so no new clock is introduced
/// and nothing can drift out of step with the audio:
///
/// - anticipation: a faint trace while the chord before a coloured one is ending, so the
///   moment is felt arriving rather than appearing from nowhere.
/// - impact: full strength as the chord lands, riding the same eased chord transition the
///   chord name and its bloom already use.
/// - decay: settling to a sustained glow that breathes with the beat, so the emphasis is
///   clearly present without strobing.
///
/// A diatonic chord resolves to zero on every phase, which is what makes it render exactly
/// as Flow always did.
struct FlowRoleEmphasis {
  static let none = FlowRoleEmphasis(current: 0, incoming: 0)

  /// Fraction of the outgoing chord during which the next one is announced.
  private static let anticipationWindow: CGFloat = 0.12
  /// What the sustained glow keeps once the impact has settled.
  private static let sustain: CGFloat = 0.62
  /// How much of the sustained glow breathes with the beat.
  private static let breath: CGFloat = 0.24

  let current: CGFloat
  let incoming: CGFloat

  /// - Parameters:
  ///   - currentHasRole: the sounding chord is advanced harmony.
  ///   - nextHasRole: the chord after it is advanced harmony.
  ///   - ease: Flow's eased chord-transition progress, 0 at the attack to 1 once settled.
  ///   - pulse: Flow's beat pulse, 1 on the beat decaying towards 0.
  ///   - segmentProgress: how far through the sounding chord we are, 0 to 1.
  static func resolve(
    currentHasRole: Bool,
    nextHasRole: Bool,
    ease: CGFloat,
    pulse: CGFloat,
    segmentProgress: CGFloat
  ) -> FlowRoleEmphasis {
    let current: CGFloat = {
      guard currentHasRole else { return 0 }
      let settled = sustain + breath * pulse
      // `ease` runs 0 to 1 across the attack, so the impact is the moment it completes.
      return min(1, settled * ease + (1 - ease) * 0.18)
    }()

    let incoming: CGFloat = {
      guard nextHasRole, !currentHasRole else { return 0 }
      let entered = (segmentProgress - (1 - anticipationWindow)) / anticipationWindow
      guard entered > 0 else { return 0 }
      return min(1, entered) * 0.22
    }()

    return FlowRoleEmphasis(current: current, incoming: incoming)
  }

  /// Nothing to draw, so a renderer can return before touching the context.
  var isSilent: Bool { current <= 0.001 && incoming <= 0.001 }

  /// The strength any single layer should be scaled by.
  var combined: CGFloat { max(current, incoming) }
}

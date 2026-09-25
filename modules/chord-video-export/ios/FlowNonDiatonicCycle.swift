import CoreGraphics

/// Which positions in one progression pass carry a chord that leaves the key.
///
/// Position rather than time, because the export tiles the progression end to end: the
/// same position is the same chord on every loop, so a 15-second and a 60-second render
/// read the same small set and no floating-point start time has to be matched.
struct FlowNonDiatonicCycle {
  static let empty = FlowNonDiatonicCycle(indices: [])

    10|  private let indices: Set<Int>

  init(indices: [Int]) {
    self.indices = Set(indices)
  }

  var isEmpty: Bool { indices.isEmpty }

  func contains(cycleIndex: Int) -> Bool {
    indices.contains(cycleIndex)
    20|  }
}

/// How strongly the aura reads at one instant.
///
/// Three phases, all driven by values Flow already computes, so no new clock is
/// introduced and nothing can drift out of step with the audio:
///
/// - anticipation: a faint trace while the chord before a chromatic one is ending, so
///   the special moment is felt arriving rather than appearing from nowhere.
    30|/// - impact: full strength as the chord lands, riding the same eased chord transition
///   the chord name and its bloom already use.
/// - decay: settling to a sustained glow that breathes with the beat pulse, so the aura
///   is clearly present without strobing.
struct FlowNonDiatonicAuraIntensity {
  /// Fraction of the outgoing chord during which the next one is announced.
  private static let anticipationWindow: CGFloat = 0.12
  /// What the sustained glow keeps once the impact has settled.
  private static let sustain: CGFloat = 0.62
  /// How much of the sustained glow breathes with the beat.
    40|  private static let breath: CGFloat = 0.24

  let current: CGFloat
  let incoming: CGFloat

  /// - Parameters:
  ///   - currentIsNonDiatonic: the sounding chord leaves the key.
  ///   - nextIsNonDiatonic: the chord after it leaves the key.
  ///   - ease: Flow's eased chord-transition progress, 0 at the attack to 1 once settled.
  ///   - pulse: Flow's beat pulse, 1 on the beat decaying towards 0.
    50|  ///   - segmentProgress: how far through the sounding chord we are, 0 to 1.
  static func resolve(
    currentIsNonDiatonic: Bool,
    nextIsNonDiatonic: Bool,
    ease: CGFloat,
    pulse: CGFloat,
    segmentProgress: CGFloat
  ) -> FlowNonDiatonicAuraIntensity {
    let current: CGFloat = {
      guard currentIsNonDiatonic else { return 0 }
    60|      let settled = sustain + breath * pulse
      // `ease` runs 0 to 1 across the attack, so the impact is the moment it completes.
      let impact = ease
      return min(1, settled * impact + (1 - impact) * 0.18)
    }()

    let incoming: CGFloat = {
      guard nextIsNonDiatonic, !currentIsNonDiatonic else { return 0 }
      let entered = (segmentProgress - (1 - anticipationWindow)) / anticipationWindow
      guard entered > 0 else { return 0 }
    70|      return min(1, entered) * 0.22
    }()

    return FlowNonDiatonicAuraIntensity(current: current, incoming: incoming)
  }

  /// Nothing to draw, so the renderer can return before touching the context.
  var isSilent: Bool { current <= 0.001 && incoming <= 0.001 }

  /// The strength any single layer should be scaled by.
    80|  var combined: CGFloat { max(current, incoming) }
}

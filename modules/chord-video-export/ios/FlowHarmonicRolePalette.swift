import UIKit

/// The four colours the video paints one chord with, all sharing a hue.
///
/// Light is the chord's own colour getting brighter, never a second colour layered over
/// it: a magenta chord under a green glow reads as two unrelated things at once.
struct FlowHarmonicRoleColors {
  let main: UIColor
  let outline: UIColor
  let glowCore: UIColor
  let glowOuter: UIColor
  let note: UIColor
}

/// Role colours per position in one progression pass.
///
/// Position rather than time, because the export tiles the progression end to end, so the
/// same position is the same chord on every loop.
///
/// A position with no entry is a diatonic chord, and `colors` returns nil for it so every
/// renderer takes its original path: the segment's own harmonic-function colour, Flow's
/// original bloom, and no outline. Classic never receives this palette at all, because its
/// accepted output is frozen.
struct FlowHarmonicRolePalette {
  static let empty = FlowHarmonicRolePalette(colorsByCycleIndex: [:])

  private let colorsByCycleIndex: [Int: FlowHarmonicRoleColors]

  init(colorsByCycleIndex: [Int: FlowHarmonicRoleColors]) {
    self.colorsByCycleIndex = colorsByCycleIndex
  }

  var isEmpty: Bool { colorsByCycleIndex.isEmpty }

  /// Whether this position is advanced harmony, and so gets the extra light.
  func has(cycleIndex: Int) -> Bool {
    colorsByCycleIndex[cycleIndex] != nil
  }

  /// Colours for a position, or nil when the chord there is diatonic.
  func colors(cycleIndex: Int) -> FlowHarmonicRoleColors? {
    colorsByCycleIndex[cycleIndex]
  }
}

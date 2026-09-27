import UIKit

/// The colours of the light around one chord. Never its fill.
///
/// The glyph body stays on the segment's own harmonic-function colour, so a borrowed `Fm`
/// is the same subdominant amber as the `F` beside it and only the light says it was
/// borrowed. These three share a hue with each other, deliberately not with the fill.
struct FlowHarmonicRoleColors {
  /// Small identifying marks: the rail dot, and nothing large.
  let accent: UIColor
  let outline: UIColor
  let glowCore: UIColor
  let glowOuter: UIColor
  /// The wash behind the chord. Deeper than `glowOuter`, because it covers most of the frame
  /// and the chord itself has to stay the brightest thing in it.
  let aura: UIColor
}

/// Role colours per position in one progression pass.
///
/// Position rather than time, because the export tiles the progression end to end, so the
/// same position is the same chord on every loop.
///
/// A position with no entry is a diatonic chord, and `colors` returns nil for it so every
/// renderer takes its original path: Flow's original bloom and no outline. The
/// harmonic-function colour is not part of that distinction — every chord is filled with it,
/// advanced or not. Classic never receives this palette at all, because its accepted output is
/// frozen.
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

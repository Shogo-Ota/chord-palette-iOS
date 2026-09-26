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
/// Empty means Classic-style rendering: every layer derives from the segment's own
/// harmonic-function colour, exactly as it did before roles existed. Classic itself never
/// receives this palette, because its accepted output is frozen.
struct FlowHarmonicRolePalette {
  static let empty = FlowHarmonicRolePalette(colorsByCycleIndex: [:])

  private let colorsByCycleIndex: [Int: FlowHarmonicRoleColors]

  init(colorsByCycleIndex: [Int: FlowHarmonicRoleColors]) {
    self.colorsByCycleIndex = colorsByCycleIndex
  }

  var isEmpty: Bool { colorsByCycleIndex.isEmpty }

  /// Colours for a position, or the segment's own colour spread across every layer when
  /// no role was sent.
  func colors(cycleIndex: Int, fallback: UIColor) -> FlowHarmonicRoleColors {
    colorsByCycleIndex[cycleIndex]
      ?? FlowHarmonicRoleColors(
        main: fallback,
        outline: fallback,
        glowCore: fallback,
        glowOuter: fallback,
        note: fallback
      )
  }
}

import CoreGraphics
import UIKit

/// The violet aura that marks a chord which leaves the key.
///
/// It is laid around the chord, never over it. The chord keeps its harmonic-function
/// colour — a borrowed iv stays yellow — so the viewer still reads what the chord does
/// while seeing that this moment is not ordinary. Violet is used because no function
/// claims that hue, so the aura cannot be mistaken for a fourth function.
///
/// Everything gathers on the letters. An earlier version outlined the whole chord area
/// with a violet rectangle, which read as the chord being fenced in rather than lit up.
/// What is left is a soft bloom behind the text, a violet rim on the glyphs themselves
/// (drawn by the chord hero, which owns the text geometry) and an afterglow on the keys.
///
/// Deliberately no blur filters and no particles: the aura has to survive social-video
/// compression at thumbnail size, and a soft-edged gradient reads at that size where
/// scattered specks turn to mud. It also has to stay cheap enough to draw every frame.
enum FlowNonDiatonicAuraRenderer {
  /// Violet, matching `videoColors.effect.nonDiatonicAura`.
  static let auraColor = UIColor(
    red: 0xa8 / 255, green: 0x55 / 255, blue: 0xf7 / 255, alpha: 1)

  /// Draw the aura behind the chord hero, before the chord name is painted over it.
  static func drawBackdrop(
    intensity: FlowNonDiatonicAuraIntensity,
    cg: CGContext,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    guard !intensity.isSilent else { return }
    let center = CGPoint(x: width / 2, y: height * 0.33)

    // A wide, very soft bloom sitting outside the chord's own glow, so the function
    // colour at the centre is untouched and the violet only shows at the edges.
    radialGlow(
      cg,
      center: center,
      radius: width * 0.86,
      alpha: 0.20 * intensity.combined
    )
    radialGlow(
      cg,
      center: center,
      radius: width * 0.52,
      alpha: 0.10 * intensity.current
    )
  }

  /// Lay a violet afterglow around keys that are already lit in their function colour.
  ///
  /// Kept deliberately weak. A first pass washed the key in violet strongly enough that
  /// a red key read as a pink key, which loses the function the colour was there to
  /// carry. The glow now sits mostly outside the key: a halo, a faint rim, and almost no
  /// fill, so the key still reads as T / SD / D with something around it.
  static func drawKeyAfterglow(
    intensity: FlowNonDiatonicAuraIntensity,
    rects: [CGRect],
    cg: CGContext,
    frameHeight height: CGFloat
  ) {
    guard intensity.current > 0.001, !rects.isEmpty else { return }
    cg.saveGState()
    cg.setShadow(
      offset: .zero,
      blur: height * 0.009 * (0.6 + 0.6 * intensity.current),
      color: auraColor.withAlphaComponent(0.55 * intensity.current).cgColor
    )
    for rect in rects {
      let path = UIBezierPath(roundedRect: rect, cornerRadius: rect.width * 0.22)
      auraColor.withAlphaComponent(0.06 * intensity.current).setFill()
      path.fill()
      auraColor.withAlphaComponent(0.30 * intensity.current).setStroke()
      path.lineWidth = max(1, rect.width * 0.06)
      path.stroke()
    }
    cg.restoreGState()
  }

  /// Mark the rail dot of a chromatic chord, so the aura is legible on the timeline too.
  static func drawRailMark(
    center: CGPoint,
    radius: CGFloat,
    alpha: CGFloat,
    cg: CGContext
  ) {
    guard alpha > 0.001 else { return }
    let rect = CGRect(
      x: center.x - radius,
      y: center.y - radius,
      width: radius * 2,
      height: radius * 2
    )
    cg.saveGState()
    cg.setShadow(
      offset: .zero,
      blur: radius * 1.8,
      color: auraColor.withAlphaComponent(0.75 * alpha).cgColor
    )
    let ring = UIBezierPath(ovalIn: rect.insetBy(dx: -radius * 0.55, dy: -radius * 0.55))
    auraColor.withAlphaComponent(0.8 * alpha).setStroke()
    ring.lineWidth = max(1, radius * 0.42)
    ring.stroke()
    cg.restoreGState()
  }

  private static func radialGlow(
    _ cg: CGContext,
    center: CGPoint,
    radius: CGFloat,
    alpha: CGFloat
  ) {
    guard alpha > 0.001, radius > 0 else { return }
    let colors = [
      auraColor.withAlphaComponent(alpha).cgColor,
      auraColor.withAlphaComponent(0).cgColor,
    ] as CFArray
    guard
      let gradient = CGGradient(
        colorsSpace: CGColorSpaceCreateDeviceRGB(),
        colors: colors,
        locations: [0, 1]
      )
    else { return }
    cg.saveGState()
    cg.drawRadialGradient(
      gradient,
      startCenter: center,
      startRadius: 0,
      endCenter: center,
      endRadius: radius,
      options: []
    )
    cg.restoreGState()
  }

}

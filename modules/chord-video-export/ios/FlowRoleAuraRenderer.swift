import CoreGraphics
import UIKit

/// The extra light an advanced-harmony chord gets, beyond what every chord already has.
///
/// It owns no colour. Hue comes from the chord's visual harmonic role, so a secondary
/// leading-tone diminished glows magenta and a borrowed subdominant glows green — what
/// marks the chord out is that this layer exists at all, not that it is a different colour
/// from the chord it surrounds.
///
/// Scope is deliberately narrow. The keyboard and the falling notes are untouched: the
/// chord name is the subject of the frame, and spreading the colour across the lower half
/// would take the frame away from it. What is left is a bloom behind the text and a ring on
/// the rail dot.
enum FlowRoleAuraRenderer {
  /// A wide, soft bloom sitting outside the chord's own glow, so the fill at the centre is
  /// untouched and the role colour only shows as air around the letters.
  static func drawBackdrop(
    emphasis: FlowRoleEmphasis,
    color: UIColor,
    cg: CGContext,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    guard !emphasis.isSilent else { return }
    let center = CGPoint(x: width / 2, y: height * 0.33)
    radialGlow(cg, center: center, radius: width * 0.86, alpha: 0.20 * emphasis.combined, color: color)
    radialGlow(cg, center: center, radius: width * 0.52, alpha: 0.10 * emphasis.current, color: color)
  }

  /// Ring the rail dot, so the timeline shows where the coloured chords sit even before one
  /// of them is sounding.
  static func drawRailMark(
    center: CGPoint,
    radius: CGFloat,
    alpha: CGFloat,
    color: UIColor,
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
      color: color.withAlphaComponent(0.75 * alpha).cgColor
    )
    let ring = UIBezierPath(ovalIn: rect.insetBy(dx: -radius * 0.55, dy: -radius * 0.55))
    color.withAlphaComponent(0.8 * alpha).setStroke()
    ring.lineWidth = max(1, radius * 0.42)
    ring.stroke()
    cg.restoreGState()
  }

  private static func radialGlow(
    _ cg: CGContext,
    center: CGPoint,
    radius: CGFloat,
    alpha: CGFloat,
    color: UIColor
  ) {
    guard alpha > 0.001, radius > 0 else { return }
    let colors = [
      color.withAlphaComponent(alpha).cgColor,
      color.withAlphaComponent(0).cgColor,
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

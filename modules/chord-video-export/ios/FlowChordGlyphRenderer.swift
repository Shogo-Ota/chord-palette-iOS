import CoreGraphics
import UIKit

/// Draws the chord name as a lit glyph: an outer contour, three glow layers, then the fill.
///
/// The contour is the reason this exists. Stroking the glyphs directly traces every path
/// boundary a font contains, and `#` is four bars that cross, so the crossings each got
/// their own interior outline — visible, and wrong. What should be outlined is the
/// silhouette of the finished string.
///
/// A true contour means building an alpha mask, dilating it and subtracting the original.
/// Core Image can do that; this renderer must not, because the Flow effect budget forbids
/// filter passes and nothing else in the module uses them. The union of the same string
/// drawn at small offsets in every direction gives the same silhouette: interiors are
/// covered by neighbouring copies, only the outer edge is left uncovered, and the fill
/// goes on top last so nothing inside can show through.
enum FlowChordGlyphRenderer {
  /// Offsets in one ring. Twelve keeps the contour smooth at 1080px wide without the ring
  /// becoming the dominant per-frame cost.
  private static let contourSteps = 12

  struct Layers {
    let fill: UIColor
    let outline: UIColor
    let glowCore: UIColor
    let glowOuter: UIColor
  }

  /// - Parameters:
  ///   - intensity: 0 while the chord is arriving, 1 once it has landed.
  ///   - impact: extra brightness for the moment of the attack, decaying with the beat.
  static func draw(
    _ text: String,
    font: UIFont,
    layers: Layers,
    centerX: CGFloat,
    y: CGFloat,
    maxWidth: CGFloat,
    scale: CGFloat,
    intensity: CGFloat,
    impact: CGFloat,
    outlineWidth: CGFloat,
    glowRadius: CGFloat,
    cg: CGContext
  ) {
    guard intensity > 0.001 else { return }
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineBreakMode = .byTruncatingTail
    let rect = CGRect(
      x: centerX - maxWidth / 2,
      y: y,
      width: maxWidth,
      height: font.lineHeight * 1.4
    )

    cg.saveGState()
    cg.translateBy(x: rect.midX, y: rect.midY)
    cg.scaleBy(x: scale, y: scale)
    cg.translateBy(x: -rect.midX, y: -rect.midY)

    // Diffuse aura: wide and deliberately dim, so it reads as air around the letters
    // rather than as a blurred copy of them.
    drawPass(
      text,
      in: rect,
      font: font,
      paragraph: paragraph,
      color: layers.glowOuter.withAlphaComponent(0.34 * intensity),
      shadow: (glowRadius * 3.2, layers.glowOuter.withAlphaComponent(0.55 * intensity)),
      cg: cg
    )

    // Near glow: tight and bright. This is what makes the chord read as lit at
    // thumbnail size, where the diffuse layer alone disappears into the background.
    drawPass(
      text,
      in: rect,
      font: font,
      paragraph: paragraph,
      color: layers.glowCore.withAlphaComponent(0.55 * intensity),
      shadow: (
        glowRadius * (1.0 + 0.5 * impact),
        layers.glowCore.withAlphaComponent((0.75 + 0.25 * impact) * intensity)
      ),
      cg: cg
    )

    // Outer contour: the same string offset around a ring, unioned.
    drawContour(
      text,
      in: rect,
      font: font,
      paragraph: paragraph,
      color: layers.outline.withAlphaComponent(min(1, (0.85 + 0.15 * impact) * intensity)),
      width: outlineWidth,
      cg: cg
    )

    // The fill goes last, covering every interior the ring touched.
    drawPass(
      text,
      in: rect,
      font: font,
      paragraph: paragraph,
      color: layers.fill.withAlphaComponent(intensity),
      shadow: nil,
      cg: cg
    )
    cg.restoreGState()
  }

  private static func drawContour(
    _ text: String,
    in rect: CGRect,
    font: UIFont,
    paragraph: NSParagraphStyle,
    color: UIColor,
    width: CGFloat,
    cg: CGContext
  ) {
    guard width > 0.2 else { return }
    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: color,
      .paragraphStyle: paragraph,
    ]
    for step in 0..<contourSteps {
      let angle = (CGFloat(step) / CGFloat(contourSteps)) * 2 * .pi
      let offset = CGRect(
        x: rect.origin.x + cos(angle) * width,
        y: rect.origin.y + sin(angle) * width,
        width: rect.width,
        height: rect.height
      )
      (text as NSString).draw(in: offset, withAttributes: attributes)
    }
  }

  private static func drawPass(
    _ text: String,
    in rect: CGRect,
    font: UIFont,
    paragraph: NSParagraphStyle,
    color: UIColor,
    shadow: (blur: CGFloat, color: UIColor)?,
    cg: CGContext
  ) {
    cg.saveGState()
    if let shadow, shadow.blur > 0.1 {
      cg.setShadow(offset: .zero, blur: shadow.blur, color: shadow.color.cgColor)
    }
    (text as NSString).draw(
      in: rect,
      withAttributes: [
        .font: font,
        .foregroundColor: color,
        .paragraphStyle: paragraph,
      ]
    )
    cg.restoreGState()
  }
}

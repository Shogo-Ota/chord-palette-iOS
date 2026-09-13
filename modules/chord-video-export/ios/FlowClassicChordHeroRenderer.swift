import CoreGraphics
import UIKit

/// Flow's center hero, matched to the accepted Classic chord presentation.
///
/// Chord ownership still comes from ExportPlan segments. The BPM pulse affects only
/// visual scale/glow and never changes performance-note or landing timing.
enum FlowClassicChordHeroRenderer {
  private static let textPrimary = UIColor(
    red: 0xee / 255, green: 0xf1 / 255, blue: 0xf6 / 255, alpha: 1)

  static func draw(
    segment: RenderSegment,
    bpm: Int,
    timeSec: Double,
    cg: CGContext,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    let beatDuration = 60.0 / Double(max(1, bpm))
    let beatPhase = (timeSec / beatDuration).truncatingRemainder(dividingBy: 1.0)
    let pulse = CGFloat(exp(-beatPhase * 3.2))
    let chordAge = timeSec - segment.startSec
    let transition = min(0.16, segment.durationSec * 0.45)
    let chordProgress = CGFloat(
      min(1.0, max(0.0, chordAge / max(0.03, transition)))
    )
    let ease = 1 - pow(1 - chordProgress, 3)

    drawRadialGlow(
      cg,
      center: CGPoint(x: width / 2, y: height * 0.33),
      radius: width * 0.62,
      color: segment.color,
      alpha: (0.16 + 0.14 * pulse) * ease
    )

    let slide = (1 - ease) * height * 0.03
    drawCenteredScaled(
      segment.displayName,
      font: .systemFont(ofSize: height * 0.085, weight: .black),
      color: segment.color,
      centerX: width / 2,
      y: height * 0.30 + slide,
      maxWidth: width * 0.94,
      scale: 1.0 + 0.045 * pulse * ease,
      glowColor: segment.color,
      glowRadius: height * 0.02 * (0.5 + pulse),
      alpha: ease,
      cg: cg
    )

    let degreeFont = UIFont.systemFont(ofSize: height * 0.030, weight: .bold)
    let degreeY = height * 0.40 + slide * 0.5
    let degree =
      segment.keyName.map { "\(segment.degreeLabel) (\($0))" }
      ?? segment.degreeLabel
    drawCentered(
      degree,
      font: degreeFont,
      color: textPrimary.withAlphaComponent(ease),
      centerX: width / 2,
      y: degreeY,
      maxWidth: width * 0.90
    )

    if let tint = segment.keyTint {
      let degreeWidth = min(
        width * 0.90,
        (degree as NSString).size(withAttributes: [.font: degreeFont]).width
      )
      let radius = height * 0.009
      let centerX = width / 2 - degreeWidth / 2 - radius * 2.2
      let centerY = degreeY + degreeFont.lineHeight * 0.5
      tint.withAlphaComponent(ease).setFill()
      UIBezierPath(
        ovalIn: CGRect(
          x: centerX - radius,
          y: centerY - radius,
          width: radius * 2,
          height: radius * 2
        )
      ).fill()
    }
  }

  private static func drawRadialGlow(
    _ cg: CGContext,
    center: CGPoint,
    radius: CGFloat,
    color: UIColor,
    alpha: CGFloat
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

  private static func drawCenteredScaled(
    _ text: String,
    font: UIFont,
    color: UIColor,
    centerX: CGFloat,
    y: CGFloat,
    maxWidth: CGFloat,
    scale: CGFloat,
    glowColor: UIColor,
    glowRadius: CGFloat,
    alpha: CGFloat,
    cg: CGContext
  ) {
    guard alpha > 0.001 else { return }
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineBreakMode = .byTruncatingTail
    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: color.withAlphaComponent(alpha),
      .paragraphStyle: paragraph,
    ]
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
    if glowRadius > 0.1 {
      cg.setShadow(
        offset: .zero,
        blur: glowRadius,
        color: glowColor.withAlphaComponent(0.8 * alpha).cgColor
      )
    }
    (text as NSString).draw(in: rect, withAttributes: attributes)
    cg.restoreGState()
  }

  private static func drawCentered(
    _ text: String,
    font: UIFont,
    color: UIColor,
    centerX: CGFloat,
    y: CGFloat,
    maxWidth: CGFloat
  ) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineBreakMode = .byTruncatingTail
    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: color,
      .paragraphStyle: paragraph,
    ]
    let rect = CGRect(
      x: centerX - maxWidth / 2,
      y: y,
      width: maxWidth,
      height: font.lineHeight * 1.4
    )
    (text as NSString).draw(in: rect, withAttributes: attributes)
  }
}

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
    frameHeight height: CGFloat,
    roleColors: FlowHarmonicRoleColors? = nil
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

    let colors =
      roleColors
      ?? FlowHarmonicRoleColors(
        main: segment.color,
        outline: segment.color,
        glowCore: segment.color,
        glowOuter: segment.color,
        note: segment.color
      )

    // Wider and a touch stronger than before, so the chord owns the frame on a phone.
    drawRadialGlow(
      cg,
      center: CGPoint(x: width / 2, y: height * 0.33),
      radius: width * 0.74,
      color: colors.glowOuter,
      alpha: (0.21 + 0.17 * pulse) * ease
    )

    let slide = (1 - ease) * height * 0.03
    FlowChordGlyphRenderer.draw(
      segment.displayName,
      font: .systemFont(ofSize: height * 0.085, weight: .black),
      layers: FlowChordGlyphRenderer.Layers(
        fill: colors.main,
        outline: colors.outline,
        glowCore: colors.glowCore,
        glowOuter: colors.glowOuter
      ),
      centerX: width / 2,
      y: height * 0.30 + slide,
      maxWidth: width * 0.94,
      scale: 1.0 + 0.045 * pulse * ease,
      intensity: ease,
      impact: pulse,
      outlineWidth: height * 0.0026,
      glowRadius: height * 0.02 * (0.5 + pulse),
      cg: cg
    )

    // Secondary by design: same size as before, no glow, neutral colour. The chord name
    // got brighter, so anything competing with it has to stay where it was.
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

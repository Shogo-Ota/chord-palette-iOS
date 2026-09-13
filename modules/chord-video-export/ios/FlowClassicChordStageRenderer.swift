import UIKit

/// Classic-style current-chord hierarchy for Flow.
///
/// Falling performance notes are drawn before this stage, so the outlined text stays
/// readable while note motion remains visible behind it.
enum FlowClassicChordStageRenderer {
  private static let textPrimary = UIColor(
    red: 0xee / 255, green: 0xf1 / 255, blue: 0xf6 / 255, alpha: 1)
  private static let textMuted = UIColor(
    red: 0x8d / 255, green: 0x98 / 255, blue: 0xaa / 255, alpha: 1)
  private static let outline = UIColor(
    red: 0x05 / 255, green: 0x09 / 255, blue: 0x11 / 255, alpha: 0.94)
  private static let rail = UIColor(
    red: 0x31 / 255, green: 0x41 / 255, blue: 0x57 / 255, alpha: 1)

  static func draw(
    state: FlowFrameState,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    guard let current = state.currentSegment else { return }

    drawOutlinedCentered(
      current.displayName,
      baseFontSize: height * 0.100,
      weight: .black,
      fill: current.color,
      centerX: width / 2,
      y: height * 0.275,
      maxWidth: width * 0.88,
      frameHeight: height
    )

    let degree =
      current.keyName.map { "\(current.degreeLabel) (\($0))" }
      ?? current.degreeLabel
    drawOutlinedCentered(
      degree,
      baseFontSize: height * 0.027,
      weight: .bold,
      fill: textPrimary,
      centerX: width / 2,
      y: height * 0.395,
      maxWidth: width * 0.76,
      frameHeight: height
    )

    drawProgressRail(state: state, frameWidth: width, frameHeight: height)
  }

  private static func drawProgressRail(
    state: FlowFrameState,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    guard !state.cycleSegments.isEmpty else { return }
    let railY = height * 0.535
    let left = width * 0.08
    let availableWidth = width * 0.84
    let slotWidth = availableWidth / CGFloat(state.cycleSegments.count)

    rail.withAlphaComponent(0.58).setStroke()
    let baseline = UIBezierPath()
    baseline.move(to: CGPoint(x: left, y: railY))
    baseline.addLine(to: CGPoint(x: left + availableWidth, y: railY))
    baseline.lineWidth = max(1, height * 0.001)
    baseline.stroke()

    for (index, segment) in state.cycleSegments.enumerated() {
      let active = index == state.currentCycleIndex
      let centerX = left + slotWidth * (CGFloat(index) + 0.5)
      let opacity: CGFloat = active ? 1 : 0.42
      let radius = height * (active ? 0.0042 : 0.0025)
      segment.color.withAlphaComponent(opacity).setFill()
      UIBezierPath(
        ovalIn: CGRect(
          x: centerX - radius,
          y: railY - radius,
          width: radius * 2,
          height: radius * 2
        )
      ).fill()
      drawFittedCentered(
        segment.displayName,
        baseFontSize: height * (active ? 0.015 : 0.012),
        weight: active ? .black : .semibold,
        color: active ? segment.color : textMuted,
        opacity: opacity,
        centerX: centerX,
        y: railY + height * 0.012,
        maxWidth: slotWidth * 0.90
      )
    }
  }

  private static func drawOutlinedCentered(
    _ text: String,
    baseFontSize: CGFloat,
    weight: UIFont.Weight,
    fill: UIColor,
    centerX: CGFloat,
    y: CGFloat,
    maxWidth: CGFloat,
    frameHeight height: CGFloat
  ) {
    let requested = font(size: max(1, baseFontSize), weight: weight)
    let measured = (text as NSString).size(withAttributes: [.font: requested]).width
    let ratio = measured > 0 ? min(1, maxWidth / measured) : 1
    let fitted = font(size: max(1, baseFontSize * ratio), weight: weight)
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineBreakMode = .byClipping
    let rect = CGRect(
      x: centerX - maxWidth / 2,
      y: y,
      width: maxWidth,
      height: fitted.lineHeight * 1.25
    )
    (text as NSString).draw(
      in: rect,
      withAttributes: [
        .font: fitted,
        .foregroundColor: fill,
        .strokeColor: outline,
        .strokeWidth: -max(1.4, height * 0.0014),
        .paragraphStyle: paragraph,
      ]
    )
  }

  private static func drawFittedCentered(
    _ text: String,
    baseFontSize: CGFloat,
    weight: UIFont.Weight,
    color: UIColor,
    opacity: CGFloat,
    centerX: CGFloat,
    y: CGFloat,
    maxWidth: CGFloat
  ) {
    let requested = font(size: max(1, baseFontSize), weight: weight)
    let measured = (text as NSString).size(withAttributes: [.font: requested]).width
    let ratio = measured > 0 ? min(1, maxWidth / measured) : 1
    let fitted = font(size: max(1, baseFontSize * ratio), weight: weight)
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineBreakMode = .byClipping
    (text as NSString).draw(
      in: CGRect(
        x: centerX - maxWidth / 2,
        y: y,
        width: maxWidth,
        height: fitted.lineHeight * 1.25
      ),
      withAttributes: [
        .font: fitted,
        .foregroundColor: color.withAlphaComponent(min(1, max(0, opacity))),
        .paragraphStyle: paragraph,
      ]
    )
  }

  private static func font(size: CGFloat, weight: UIFont.Weight) -> UIFont {
    for name in ["NotoSansJP-ExtraBold", "NotoSansJP_800ExtraBold", "NotoSansJP-Bold"] {
      if let font = UIFont(name: name, size: size) {
        return font
      }
    }
    return .systemFont(ofSize: size, weight: weight)
  }
}

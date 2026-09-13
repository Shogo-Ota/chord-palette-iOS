import UIKit

/// Classic-style current-chord hierarchy for Flow.
///
/// Falling performance notes are drawn before this stage, so the Classic glow and
/// chord text remain in front while note motion stays visible behind them.
enum FlowClassicChordStageRenderer {
  private static let textMuted = UIColor(
    red: 0x8d / 255, green: 0x98 / 255, blue: 0xaa / 255, alpha: 1)
  private static let rail = UIColor(
    red: 0x31 / 255, green: 0x41 / 255, blue: 0x57 / 255, alpha: 1)

  static func draw(
    plan: RenderPlan,
    state: FlowFrameState,
    timeSec: Double,
    cg: CGContext,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    guard let current = state.currentSegment else { return }

    FlowClassicChordHeroRenderer.draw(
      segment: current,
      bpm: plan.bpm,
      timeSec: timeSec,
      cg: cg,
      frameWidth: width,
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

import UIKit

/// Segment-level hierarchy for Flow: dominant NOW, quieter NEXT and a thin rail.
/// Performance motion is rendered separately from FlowVisualNoteTimeline.
enum FlowHarmonicStageRenderer {
  private static let paletteGreen = UIColor(
    red: 0x2c / 255, green: 0xe6 / 255, blue: 0x9f / 255, alpha: 1)
  private static let coolBlue = UIColor(
    red: 0x4b / 255, green: 0xa8 / 255, blue: 0xff / 255, alpha: 1)
  private static let textPrimary = UIColor(
    red: 0xee / 255, green: 0xf3 / 255, blue: 0xf8 / 255, alpha: 1)
  private static let textMuted = UIColor(
    red: 0x7d / 255, green: 0x8b / 255, blue: 0xa0 / 255, alpha: 1)
  private static let lineMuted = UIColor(
    red: 0x31 / 255, green: 0x41 / 255, blue: 0x57 / 255, alpha: 1)

  static func draw(
    state: FlowFrameState,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    guard let current = state.currentSegment else { return }

    drawChordBlock(
      current,
      role: "NOW",
      centerX: width * 0.33,
      nameY: height * 0.16,
      nameSize: height * 0.105,
      maxWidth: width * 0.56,
      opacity: 1,
      color: paletteGreen,
      frameHeight: height
    )

    if let next = state.nextSegment {
      drawChordBlock(
        next,
        role: "NEXT",
        centerX: width * 0.76,
        nameY: height * 0.19,
        nameSize: height * 0.056,
        maxWidth: width * 0.38,
        opacity: 0.68,
        color: coolBlue,
        frameHeight: height
      )
    }

    drawSequenceRail(state: state, frameWidth: width, frameHeight: height)
  }

  private static func drawChordBlock(
    _ segment: RenderSegment,
    role: String,
    centerX: CGFloat,
    nameY: CGFloat,
    nameSize: CGFloat,
    maxWidth: CGFloat,
    opacity: CGFloat,
    color: UIColor,
    frameHeight height: CGFloat
  ) {
    drawFittedCenteredText(
      role,
      baseFontSize: height * 0.0115,
      weight: .black,
      color: color,
      opacity: opacity,
      centerX: centerX,
      y: nameY - height * 0.028,
      maxWidth: maxWidth
    )
    drawFittedCenteredText(
      segment.displayName,
      baseFontSize: nameSize,
      weight: .black,
      color: color,
      opacity: opacity,
      centerX: centerX,
      y: nameY,
      maxWidth: maxWidth
    )

    let degreeDisplay =
      segment.keyName.map { "\(segment.degreeLabel) (\($0))" }
      ?? segment.degreeLabel
    drawFittedCenteredText(
      degreeDisplay,
      baseFontSize: height * 0.016,
      weight: .bold,
      color: textPrimary,
      opacity: opacity * 0.88,
      centerX: centerX,
      y: nameY + nameSize,
      maxWidth: maxWidth
    )
  }

  private static func drawSequenceRail(
    state: FlowFrameState,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    guard !state.cycleSegments.isEmpty else { return }

    let railY = height * 0.37
    lineMuted.withAlphaComponent(0.56).setStroke()
    let baseline = UIBezierPath()
    baseline.move(to: CGPoint(x: width * 0.07, y: railY))
    baseline.addLine(to: CGPoint(x: width * 0.93, y: railY))
    baseline.lineWidth = max(1, height * 0.001)
    baseline.stroke()

    let availableWidth = width * 0.86
    let slotWidth = availableWidth / CGFloat(state.cycleSegments.count)
    let nextIndex =
      state.cycleSegments.count > 1
      ? (state.currentCycleIndex + 1) % state.cycleSegments.count
      : -1

    for (index, segment) in state.cycleSegments.enumerated() {
      let centerX = width * 0.07 + slotWidth * (CGFloat(index) + 0.5)
      let isCurrent = index == state.currentCycleIndex
      let isNext = index == nextIndex
      let color = isCurrent ? paletteGreen : (isNext ? coolBlue : textMuted)
      let opacity: CGFloat = isCurrent ? 1 : (isNext ? 0.78 : 0.50)
      let radius = height * (isCurrent ? 0.0038 : 0.0026)

      color.withAlphaComponent(opacity).setFill()
      UIBezierPath(
        ovalIn: CGRect(
          x: centerX - radius,
          y: railY - radius,
          width: radius * 2,
          height: radius * 2
        )
      ).fill()
      drawFittedCenteredText(
        segment.displayName,
        baseFontSize: height * (isCurrent ? 0.015 : 0.0125),
        weight: isCurrent ? .black : .semibold,
        color: color,
        opacity: opacity,
        centerX: centerX,
        y: railY + height * 0.012,
        maxWidth: slotWidth * 0.90
      )
    }
  }

  private static func drawFittedCenteredText(
    _ text: String,
    baseFontSize: CGFloat,
    weight: UIFont.Weight,
    color: UIColor,
    opacity: CGFloat,
    centerX: CGFloat,
    y: CGFloat,
    maxWidth: CGFloat
  ) {
    let requestedFont = brandFont(size: max(1, baseFontSize), weight: weight)
    let measuredWidth = (text as NSString).size(withAttributes: [.font: requestedFont]).width
    let fitRatio = measuredWidth > 0 ? min(1, maxWidth / measuredWidth) : 1
    let font = brandFont(size: max(1, baseFontSize * fitRatio), weight: weight)
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineBreakMode = .byClipping
    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: color.withAlphaComponent(min(1, max(0, opacity))),
      .paragraphStyle: paragraph,
    ]
    let rect = CGRect(
      x: centerX - maxWidth / 2,
      y: y,
      width: maxWidth,
      height: font.lineHeight * 1.25
    )
    (text as NSString).draw(in: rect, withAttributes: attributes)
  }

  private static func brandFont(size: CGFloat, weight: UIFont.Weight) -> UIFont {
    for name in ["NotoSansJP-ExtraBold", "NotoSansJP_800ExtraBold", "NotoSansJP-Bold"] {
      if let font = UIFont(name: name, size: size) {
        return font
      }
    }
    return .systemFont(ofSize: size, weight: weight)
  }
}

import UIKit

/// Flow's primary NOW -> NEXT stage.
///
/// The large chord blocks carry identity; the rail carries sequence context.
/// Motion follows FlowFrameState and never derives timing independently.
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
    cg: CGContext,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    guard let current = state.currentSegment else { return }

    if state.motionEnabled, state.nextSegment != nil {
      drawMotionPath(
        state: state,
        cg: cg,
        frameWidth: width,
        frameHeight: height
      )
    }

    drawChordBlock(
      current,
      role: "NOW",
      centerX: width * state.currentX,
      nameY: height * state.currentY,
      desiredWidth: width * 0.54,
      opacity: state.currentOpacity,
      scale: state.currentScale,
      color: paletteGreen,
      frameWidth: width,
      frameHeight: height
    )

    if let next = state.nextSegment, state.nextOpacity > 0.001 {
      drawChordBlock(
        next,
        role: "NEXT",
        centerX: width * state.nextX,
        nameY: height * state.nextY,
        desiredWidth: width * 0.44,
        opacity: state.nextOpacity,
        scale: state.nextScale,
        color: coolBlue,
        frameWidth: width,
        frameHeight: height
      )
    }

    drawSequenceRail(
      state: state,
      frameWidth: width,
      frameHeight: height
    )
  }

  private static func drawChordBlock(
    _ segment: RenderSegment,
    role: String,
    centerX: CGFloat,
    nameY: CGFloat,
    desiredWidth: CGFloat,
    opacity: CGFloat,
    scale: CGFloat,
    color: UIColor,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    let safeMargin = width * 0.04
    let sideRoom = max(1, min(centerX - safeMargin, width - safeMargin - centerX))
    let maxWidth = min(desiredWidth, sideRoom * 2)
    let requestedNameSize = height * 0.115 * scale

    drawFittedCenteredText(
      role,
      baseFontSize: height * 0.0115,
      weight: .black,
      color: color,
      opacity: opacity,
      centerX: centerX,
      y: nameY - height * 0.032,
      maxWidth: maxWidth
    )
    drawFittedCenteredText(
      segment.displayName,
      baseFontSize: requestedNameSize,
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
      baseFontSize: height * 0.017,
      weight: .bold,
      color: textPrimary,
      opacity: opacity * 0.90,
      centerX: centerX,
      y: nameY + requestedNameSize * 1.02,
      maxWidth: maxWidth
    )
  }

  private static func drawMotionPath(
    state: FlowFrameState,
    cg: CGContext,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    let start = CGPoint(x: width * state.currentX, y: height * 0.425)
    let end = CGPoint(x: width * state.nextX, y: height * 0.395)
    let span = max(width * 0.08, end.x - start.x)
    let curve = FlowStageCurve(
      start: start,
      control1: CGPoint(x: start.x + span * 0.30, y: height * 0.392),
      control2: CGPoint(x: end.x - span * 0.28, y: height * 0.438),
      end: end
    )

    let fullPath = UIBezierPath()
    fullPath.move(to: curve.start)
    fullPath.addCurve(
      to: curve.end,
      controlPoint1: curve.control1,
      controlPoint2: curve.control2
    )

    cg.saveGState()
    cg.setLineCap(.round)
    cg.setLineWidth(max(3, height * 0.0022))
    cg.setStrokeColor(lineMuted.withAlphaComponent(0.82).cgColor)
    cg.addPath(fullPath.cgPath)
    cg.strokePath()
    cg.restoreGState()

    let accentPath = partialPath(curve: curve, progress: state.pathProgress)
    cg.saveGState()
    cg.setLineCap(.round)
    cg.setLineJoin(.round)
    cg.setLineWidth(max(5, height * 0.0026))
    cg.addPath(accentPath.cgPath)
    cg.replacePathWithStrokedPath()
    cg.clip()
    if let gradient = CGGradient(
      colorsSpace: CGColorSpaceCreateDeviceRGB(),
      colors: [paletteGreen.cgColor, coolBlue.cgColor] as CFArray,
      locations: [0, 1]
    ) {
      cg.drawLinearGradient(
        gradient,
        start: curve.start,
        end: curve.end,
        options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
      )
    }
    cg.restoreGState()

    let head = cubicPoint(curve: curve, progress: state.pathProgress)
    drawMovingGlow(
      center: head,
      intensity: state.glowIntensity,
      cg: cg,
      frameWidth: width
    )
    coolBlue.withAlphaComponent(0.96).setFill()
    let headRadius = height * 0.0048
    UIBezierPath(
      ovalIn: CGRect(
        x: head.x - headRadius,
        y: head.y - headRadius,
        width: headRadius * 2,
        height: headRadius * 2
      )
    ).fill()
  }

  private static func drawMovingGlow(
    center: CGPoint,
    intensity: CGFloat,
    cg: CGContext,
    frameWidth width: CGFloat
  ) {
    let colors = [
      coolBlue.withAlphaComponent(intensity).cgColor,
      paletteGreen.withAlphaComponent(intensity * 0.34).cgColor,
      coolBlue.withAlphaComponent(0).cgColor,
    ] as CFArray
    guard
      let gradient = CGGradient(
        colorsSpace: CGColorSpaceCreateDeviceRGB(),
        colors: colors,
        locations: [0, 0.34, 1]
      )
    else { return }

    cg.saveGState()
    cg.drawRadialGradient(
      gradient,
      startCenter: center,
      startRadius: 0,
      endCenter: center,
      endRadius: width * 0.12,
      options: [.drawsAfterEndLocation]
    )
    cg.restoreGState()
  }

  private static func drawSequenceRail(
    state: FlowFrameState,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    let items = railItems(state: state)
    guard !items.isEmpty else { return }

    let railY = height * 0.555
    lineMuted.withAlphaComponent(0.58).setStroke()
    let baseline = UIBezierPath()
    baseline.move(to: CGPoint(x: width * 0.08, y: railY))
    baseline.addLine(to: CGPoint(x: width * 0.92, y: railY))
    baseline.lineWidth = max(1, height * 0.0011)
    baseline.stroke()

    let availableWidth = width * 0.84
    let slotWidth = availableWidth / CGFloat(items.count)
    for (index, item) in items.enumerated() {
      let centerX = width * 0.08 + slotWidth * (CGFloat(index) + 0.5)
      let appearance = railAppearance(role: item.role, frameHeight: height)
      appearance.color.withAlphaComponent(appearance.opacity).setFill()
      let radius = appearance.radius
      UIBezierPath(
        ovalIn: CGRect(
          x: centerX - radius,
          y: railY - radius,
          width: radius * 2,
          height: radius * 2
        )
      ).fill()

      drawFittedCenteredText(
        item.segment.displayName,
        baseFontSize: appearance.fontSize,
        weight: appearance.weight,
        color: appearance.color,
        opacity: appearance.opacity,
        centerX: centerX,
        y: railY + height * 0.014,
        maxWidth: slotWidth * 0.92
      )
    }
  }

  private static func railItems(state: FlowFrameState) -> [FlowRailItem] {
    var items: [FlowRailItem] = []
    if let previous = state.previousSegment {
      items.append(FlowRailItem(segment: previous, role: .context))
    }
    if let current = state.currentSegment {
      items.append(FlowRailItem(segment: current, role: .current))
    }
    if let next = state.nextSegment {
      items.append(FlowRailItem(segment: next, role: .next))
    }
    if let following = state.followingSegment {
      items.append(FlowRailItem(segment: following, role: .context))
    }
    return items
  }

  private static func railAppearance(
    role: FlowRailRole,
    frameHeight height: CGFloat
  ) -> (color: UIColor, opacity: CGFloat, fontSize: CGFloat, weight: UIFont.Weight, radius: CGFloat) {
    switch role {
    case .current:
      return (paletteGreen, 1, height * 0.022, .black, height * 0.0042)
    case .next:
      return (coolBlue, 0.92, height * 0.020, .bold, height * 0.0038)
    case .context:
      return (textMuted, 0.72, height * 0.016, .semibold, height * 0.0028)
    }
  }

  private static func partialPath(
    curve: FlowStageCurve,
    progress: CGFloat
  ) -> UIBezierPath {
    let path = UIBezierPath()
    let steps = 24
    let clamped = min(1, max(0, progress))
    for step in 0...steps {
      let sample = clamped * CGFloat(step) / CGFloat(steps)
      let point = cubicPoint(curve: curve, progress: sample)
      if step == 0 {
        path.move(to: point)
      } else {
        path.addLine(to: point)
      }
    }
    return path
  }

  private static func cubicPoint(
    curve: FlowStageCurve,
    progress: CGFloat
  ) -> CGPoint {
    let x = min(1, max(0, progress))
    let inverse = 1 - x
    let a = inverse * inverse * inverse
    let b = 3 * inverse * inverse * x
    let c = 3 * inverse * x * x
    let d = x * x * x
    return CGPoint(
      x: a * curve.start.x + b * curve.control1.x + c * curve.control2.x + d * curve.end.x,
      y: a * curve.start.y + b * curve.control1.y + c * curve.control2.y + d * curve.end.y
    )
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

private struct FlowStageCurve {
  let start: CGPoint
  let control1: CGPoint
  let control2: CGPoint
  let end: CGPoint
}

private struct FlowRailItem {
  let segment: RenderSegment
  let role: FlowRailRole
}

private enum FlowRailRole {
  case context
  case current
  case next
}

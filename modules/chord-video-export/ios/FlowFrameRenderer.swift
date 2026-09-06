import CoreGraphics
import UIKit

/// Continuity and harmonic-motion visualization.
///
/// All animation state is resolved from RenderPlan.segments by FlowFrameStateResolver.
struct FlowFrameRenderer: VideoFrameRendering {
  private static let backgroundTop = UIColor(
    red: 0x11 / 255, green: 0x1a / 255, blue: 0x30 / 255, alpha: 1)
  private static let backgroundMid = UIColor(
    red: 0x08 / 255, green: 0x10 / 255, blue: 0x1f / 255, alpha: 1)
  private static let backgroundBottom = UIColor(
    red: 0x04 / 255, green: 0x07 / 255, blue: 0x0d / 255, alpha: 1)
  private static let paletteGreen = UIColor(
    red: 0x2c / 255, green: 0xe6 / 255, blue: 0x9f / 255, alpha: 1)
  private static let coolBlue = UIColor(
    red: 0x4b / 255, green: 0xa8 / 255, blue: 0xff / 255, alpha: 1)
  private static let textPrimary = UIColor(
    red: 0xee / 255, green: 0xf3 / 255, blue: 0xf8 / 255, alpha: 1)
  private static let textMuted = UIColor(
    red: 0x8e / 255, green: 0x9b / 255, blue: 0xae / 255, alpha: 1)
  private static let lineMuted = UIColor(
    red: 0x2a / 255, green: 0x37 / 255, blue: 0x4b / 255, alpha: 1)

  func makeImage(plan: RenderPlan, timeSec: Double) -> CGImage? {
    let size = CGSize(width: plan.width, height: plan.height)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    let state = FlowFrameStateResolver.resolve(plan: plan, timeSec: timeSec)

    return renderer.image { context in
      draw(plan: plan, state: state, cg: context.cgContext, size: size)
    }.cgImage
  }

  private func draw(
    plan: RenderPlan,
    state: FlowFrameState,
    cg: CGContext,
    size: CGSize
  ) {
    let width = size.width
    let height = size.height
    drawBackground(cg: cg, size: size)
    drawHeader(plan: plan, frameWidth: width, frameHeight: height)

    if let current = state.currentSegment {
      drawCurrentChord(
        current,
        state: state,
        frameWidth: width,
        frameHeight: height
      )
      drawHarmonicMotion(
        state: state,
        cg: cg,
        frameWidth: width,
        frameHeight: height
      )
      FlowKeyboardRenderer.draw(
        plan: plan,
        currentSegment: current,
        rect: CGRect(
          x: width * 0.12,
          y: height * 0.65,
          width: width * 0.76,
          height: height * 0.105
        ),
        frameHeight: height
      )
    } else {
      drawFittedCenteredText(
        "コードがありません",
        baseFontSize: height * 0.032,
        weight: .bold,
        color: Self.textMuted,
        opacity: 1,
        scale: 1,
        centerX: width / 2,
        y: height * 0.30,
        maxWidth: width * 0.86
      )
    }

    if plan.watermark {
      FlowBrandRenderer.draw(frameWidth: width, frameHeight: height)
    }
  }

  private func drawBackground(cg: CGContext, size: CGSize) {
    let colors = [
      Self.backgroundTop.cgColor,
      Self.backgroundMid.cgColor,
      Self.backgroundBottom.cgColor,
    ] as CFArray
    let space = CGColorSpaceCreateDeviceRGB()
    guard
      let gradient = CGGradient(
        colorsSpace: space,
        colors: colors,
        locations: [0, 0.56, 1]
      )
    else {
      Self.backgroundBottom.setFill()
      cg.fill(CGRect(origin: .zero, size: size))
      return
    }

    cg.drawLinearGradient(
      gradient,
      start: CGPoint(x: 0, y: 0),
      end: CGPoint(x: 0, y: size.height),
      options: []
    )
  }

  private func drawHeader(plan: RenderPlan, frameWidth width: CGFloat, frameHeight height: CGFloat) {
    drawFittedCenteredText(
      plan.title,
      baseFontSize: height * 0.026,
      weight: .heavy,
      color: Self.textPrimary,
      opacity: 0.94,
      scale: 1,
      centerX: width / 2,
      y: height * 0.055,
      maxWidth: width * 0.86
    )
    drawFittedCenteredText(
      "FLOW  ·  BPM \(plan.bpm)",
      baseFontSize: height * 0.013,
      weight: .semibold,
      color: Self.textMuted,
      opacity: 0.82,
      scale: 1,
      centerX: width / 2,
      y: height * 0.098,
      maxWidth: width * 0.78
    )
  }

  private func drawCurrentChord(
    _ segment: RenderSegment,
    state: FlowFrameState,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    drawFittedCenteredText(
      segment.displayName,
      baseFontSize: height * 0.088,
      weight: .black,
      color: Self.paletteGreen,
      opacity: state.currentOpacity,
      scale: state.currentScale,
      centerX: width / 2,
      y: height * 0.215,
      maxWidth: width * 0.88
    )

    let degreeDisplay =
      segment.keyName.map { "\(segment.degreeLabel) (\($0))" }
      ?? segment.degreeLabel
    drawFittedCenteredText(
      degreeDisplay,
      baseFontSize: height * 0.021,
      weight: .bold,
      color: Self.textPrimary,
      opacity: 0.88,
      scale: 1,
      centerX: width / 2,
      y: height * 0.355,
      maxWidth: width * 0.76
    )
  }

  private func drawHarmonicMotion(
    state: FlowFrameState,
    cg: CGContext,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    guard state.motionEnabled, let current = state.currentSegment else {
      return
    }

    let curve = motionCurve(frameWidth: width, frameHeight: height)
    cg.saveGState()
    cg.setLineCap(.round)
    cg.setLineJoin(.round)
    cg.setLineWidth(max(1.5, height * 0.0014))
    cg.setStrokeColor(Self.lineMuted.withAlphaComponent(0.72).cgColor)
    cg.addPath(curve.path.cgPath)
    cg.strokePath()
    cg.restoreGState()

    let glowX =
      state.currentX + (state.nextX - state.currentX) * state.glowProgress
    let glowT = min(1, max(0, (glowX - 0.10) / 0.80))
    let glowCenter = cubicPoint(
      t: glowT,
      start: curve.start,
      control1: curve.control1,
      control2: curve.control2,
      end: curve.end
    )
    let accent = flowAccent(progress: state.glowProgress * 2)

    drawMovingGlow(
      center: glowCenter,
      color: accent,
      cg: cg,
      frameWidth: width,
      frameHeight: height
    )
    drawLocalizedMotionStroke(
      centerT: glowT,
      curve: curve,
      color: accent,
      cg: cg,
      frameHeight: height
    )

    if let previous = state.previousSegment, state.previousOpacity > 0.001 {
      drawMotionLabel(
        previous,
        normalizedX: state.previousX,
        opacity: state.previousOpacity,
        scale: state.previousScale,
        color: Self.textMuted,
        frameWidth: width,
        frameHeight: height
      )
    }

    drawMotionLabel(
      current,
      normalizedX: state.currentX,
      opacity: state.currentOpacity,
      scale: state.currentScale,
      color: Self.paletteGreen,
      frameWidth: width,
      frameHeight: height
    )

    if let next = state.nextSegment, state.nextOpacity > 0.001 {
      drawMotionLabel(
        next,
        normalizedX: state.nextX,
        opacity: state.nextOpacity,
        scale: state.nextScale,
        color: Self.coolBlue,
        frameWidth: width,
        frameHeight: height
      )
    }
  }

  private func drawMotionLabel(
    _ segment: RenderSegment,
    normalizedX: CGFloat,
    opacity: CGFloat,
    scale: CGFloat,
    color: UIColor,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    let centerX = width * normalizedX
    let nodeCenter = CGPoint(x: centerX, y: height * 0.515)
    color.withAlphaComponent(opacity * 0.78).setFill()
    UIBezierPath(
      ovalIn: CGRect(
        x: nodeCenter.x - height * 0.004,
        y: nodeCenter.y - height * 0.004,
        width: height * 0.008,
        height: height * 0.008
      )
    ).fill()

    drawFittedCenteredText(
      segment.displayName,
      baseFontSize: height * 0.0145,
      weight: .semibold,
      color: color,
      opacity: opacity,
      scale: scale,
      centerX: centerX,
      y: height * 0.465,
      maxWidth: width * 0.25
    )
  }

  private func drawMovingGlow(
    center: CGPoint,
    color: UIColor,
    cg: CGContext,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    let colors = [
      color.withAlphaComponent(0.15).cgColor,
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
      endRadius: width * 0.13,
      options: [.drawsAfterEndLocation]
    )
    cg.restoreGState()
  }

  private func drawLocalizedMotionStroke(
    centerT: CGFloat,
    curve: MotionCurve,
    color: UIColor,
    cg: CGContext,
    frameHeight height: CGFloat
  ) {
    let startT = max(0, centerT - 0.075)
    let endT = min(1, centerT + 0.075)
    let steps = 10
    let path = UIBezierPath()
    for step in 0...steps {
      let fraction = CGFloat(step) / CGFloat(steps)
      let t = startT + (endT - startT) * fraction
      let point = cubicPoint(
        t: t,
        start: curve.start,
        control1: curve.control1,
        control2: curve.control2,
        end: curve.end
      )
      if step == 0 {
        path.move(to: point)
      } else {
        path.addLine(to: point)
      }
    }

    cg.saveGState()
    cg.setLineCap(.round)
    cg.setLineWidth(max(2, height * 0.0022))
    cg.setStrokeColor(color.withAlphaComponent(0.88).cgColor)
    cg.addPath(path.cgPath)
    cg.strokePath()
    cg.restoreGState()
  }

  private func motionCurve(frameWidth width: CGFloat, frameHeight height: CGFloat) -> MotionCurve {
    let start = CGPoint(x: width * 0.10, y: height * 0.515)
    let control1 = CGPoint(x: width * 0.34, y: height * 0.498)
    let control2 = CGPoint(x: width * 0.66, y: height * 0.532)
    let end = CGPoint(x: width * 0.90, y: height * 0.515)
    let path = UIBezierPath()
    path.move(to: start)
    path.addCurve(to: end, controlPoint1: control1, controlPoint2: control2)
    return MotionCurve(
      path: path,
      start: start,
      control1: control1,
      control2: control2,
      end: end
    )
  }

  private func cubicPoint(
    t: CGFloat,
    start: CGPoint,
    control1: CGPoint,
    control2: CGPoint,
    end: CGPoint
  ) -> CGPoint {
    let x = min(1, max(0, t))
    let inverse = 1 - x
    let a = inverse * inverse * inverse
    let b = 3 * inverse * inverse * x
    let c = 3 * inverse * x * x
    let d = x * x * x
    return CGPoint(
      x: a * start.x + b * control1.x + c * control2.x + d * end.x,
      y: a * start.y + b * control1.y + c * control2.y + d * end.y
    )
  }

  private func flowAccent(progress: CGFloat) -> UIColor {
    let x = min(1, max(0, progress))
    return UIColor(
      red: (0x2c / 255) + ((0x4b / 255) - (0x2c / 255)) * x,
      green: (0xe6 / 255) + ((0xa8 / 255) - (0xe6 / 255)) * x,
      blue: (0x9f / 255) + ((0xff / 255) - (0x9f / 255)) * x,
      alpha: 1
    )
  }

  private func drawFittedCenteredText(
    _ text: String,
    baseFontSize: CGFloat,
    weight: UIFont.Weight,
    color: UIColor,
    opacity: CGFloat,
    scale: CGFloat,
    centerX: CGFloat,
    y: CGFloat,
    maxWidth: CGFloat
  ) {
    let requestedSize = max(1, baseFontSize * scale)
    let requestedFont = Self.brandFont(size: requestedSize, weight: weight)
    let measuredWidth = (text as NSString).size(withAttributes: [.font: requestedFont]).width
    let fitRatio = measuredWidth > 0 ? min(1, maxWidth / measuredWidth) : 1
    let font = Self.brandFont(size: max(1, requestedSize * fitRatio), weight: weight)
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

private struct MotionCurve {
  let path: UIBezierPath
  let start: CGPoint
  let control1: CGPoint
  let control2: CGPoint
  let end: CGPoint
}

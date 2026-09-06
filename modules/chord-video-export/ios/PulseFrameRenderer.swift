import CoreGraphics
import UIKit

/// Rhythm/progress visualization. It intentionally does not reuse Classic animation.
struct PulseFrameRenderer: VideoFrameRendering {
  private static let bgTop = UIColor(
    red: 0x12 / 255, green: 0x19 / 255, blue: 0x2d / 255, alpha: 1)
  private static let bgBottom = UIColor(
    red: 0x06 / 255, green: 0x09 / 255, blue: 0x11 / 255, alpha: 1)
  private static let trackBase = UIColor(
    red: 0x2b / 255, green: 0x35 / 255, blue: 0x49 / 255, alpha: 1)
  private static let textPrimary = UIColor(
    red: 0xee / 255, green: 0xf1 / 255, blue: 0xf6 / 255, alpha: 1)
  private static let textMuted = UIColor(
    red: 0x9a / 255, green: 0xa3 / 255, blue: 0xb5 / 255, alpha: 1)
  private static let whiteKey = UIColor(
    red: 0xe9 / 255, green: 0xed / 255, blue: 0xf5 / 255, alpha: 1)
  private static let blackKey = UIColor(
    red: 0x0e / 255, green: 0x13 / 255, blue: 0x20 / 255, alpha: 1)

  func makeImage(plan: RenderPlan, timeSec: Double) -> CGImage? {
    let size = CGSize(width: plan.width, height: plan.height)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    let state = PulseFrameStateResolver.resolve(plan: plan, timeSec: timeSec)

    return renderer.image { context in
      draw(
        plan: plan,
        state: state,
        cg: context.cgContext,
        size: size
      )
    }.cgImage
  }

  private func draw(
    plan: RenderPlan,
    state: PulseFrameState,
    cg: CGContext,
    size: CGSize
  ) {
    let width = size.width
    let height = size.height
    drawBackground(cg: cg, size: size)

    drawCentered(
      plan.title,
      font: Self.brandFont(size: height * 0.026),
      color: Self.textPrimary,
      centerX: width / 2,
      y: height * 0.06,
      maxWidth: width * 0.9
    )
    drawCentered(
      "PULSE  ·  BPM \(plan.bpm)",
      font: .systemFont(ofSize: height * 0.014, weight: .semibold),
      color: Self.textMuted,
      centerX: width / 2,
      y: height * 0.105,
      maxWidth: width * 0.9
    )

    if let active = state.activeSegment {
      drawCurrentChord(active, state: state, frameWidth: width, frameHeight: height)
      drawProgressTrace(
        state: state,
        accent: active.color,
        cg: cg,
        frameWidth: width,
        frameHeight: height
      )
      drawKeyboard(
        plan: plan,
        activeSegment: active,
        accent: active.color,
        rect: CGRect(
          x: width * 0.08,
          y: height * 0.64,
          width: width * 0.84,
          height: height * 0.14
        ),
        frameHeight: height
      )
    } else {
      drawCentered(
        "コードがありません",
        font: .systemFont(ofSize: height * 0.032, weight: .bold),
        color: Self.textMuted,
        centerX: width / 2,
        y: height * 0.30,
        maxWidth: width * 0.86
      )
    }

    if plan.watermark {
      drawWatermark(frameWidth: width, frameHeight: height)
    }
  }

  private func drawBackground(cg: CGContext, size: CGSize) {
    let colors = [Self.bgTop.cgColor, Self.bgBottom.cgColor] as CFArray
    let space = CGColorSpaceCreateDeviceRGB()
    guard
      let gradient = CGGradient(
        colorsSpace: space,
        colors: colors,
        locations: [0, 1]
      )
    else {
      Self.bgBottom.setFill()
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

  private func drawCurrentChord(
    _ segment: RenderSegment,
    state: PulseFrameState,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    drawCentered(
      segment.displayName,
      font: .systemFont(ofSize: height * 0.080, weight: .black),
      color: segment.color,
      centerX: width / 2,
      y: height * 0.25,
      maxWidth: width * 0.92
    )
    let degreeDisplay =
      segment.keyName.map { "\(segment.degreeLabel) (\($0))" }
      ?? segment.degreeLabel
    drawCentered(
      degreeDisplay,
      font: .systemFont(ofSize: height * 0.026, weight: .bold),
      color: Self.textPrimary,
      centerX: width / 2,
      y: height * 0.36,
      maxWidth: width * 0.86
    )

    guard state.onsetEmphasis > 0.001, let context = UIGraphicsGetCurrentContext() else {
      return
    }
    let focusWidth = width * (0.10 + 0.12 * state.onsetEmphasis)
    let focusY = height * 0.405
    context.saveGState()
    context.setLineCap(.round)
    context.setLineWidth(max(2, height * 0.003))
    context.setStrokeColor(
      segment.color.withAlphaComponent(0.25 + 0.65 * state.onsetEmphasis).cgColor
    )
    context.move(to: CGPoint(x: width / 2 - focusWidth / 2, y: focusY))
    context.addLine(to: CGPoint(x: width / 2 + focusWidth / 2, y: focusY))
    context.strokePath()
    context.restoreGState()
  }

  private func drawProgressTrace(
    state: PulseFrameState,
    accent: UIColor,
    cg: CGContext,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    let segments = state.cycleSegments
    guard !segments.isEmpty else { return }

    let startX = width * 0.10
    let endX = width * 0.90
    let baselineY = height * 0.52
    let traceWidth = endX - startX
    let cycleDuration = segments.reduce(0.0) {
      $0 + max(0.000_001, $1.durationSec)
    }

    cg.saveGState()
    cg.setLineCap(.round)
    cg.setLineWidth(max(2, height * 0.003))
    cg.setStrokeColor(Self.trackBase.cgColor)
    cg.move(to: CGPoint(x: startX, y: baselineY))
    cg.addLine(to: CGPoint(x: endX, y: baselineY))
    cg.strokePath()

    let traceHeadX = startX + traceWidth * state.traceProgress
    cg.setLineWidth(max(3, height * 0.0045))
    cg.setStrokeColor(accent.withAlphaComponent(0.92).cgColor)
    cg.move(to: CGPoint(x: startX, y: baselineY))
    cg.addLine(to: CGPoint(x: traceHeadX, y: baselineY))
    cg.strokePath()
    cg.restoreGState()

    var elapsed = 0.0
    let showLabels = segments.count <= 8
    for (index, segment) in segments.enumerated() {
      let fraction = CGFloat(elapsed / max(0.000_001, cycleDuration))
      let nodeX = startX + traceWidth * fraction
      if index == state.activeCycleIndex {
        drawActiveTraceNode(
          segment: segment,
          x: nodeX,
          baselineY: baselineY,
          state: state,
          cg: cg,
          frameWidth: width,
          frameHeight: height
        )
      } else {
        let radius = max(4, height * 0.005)
        segment.color.withAlphaComponent(0.42).setFill()
        UIBezierPath(
          ovalIn: CGRect(
            x: nodeX - radius,
            y: baselineY - radius,
            width: radius * 2,
            height: radius * 2
          )
        ).fill()
        if showLabels {
          drawCentered(
            segment.displayName,
            font: .systemFont(ofSize: height * 0.012, weight: .semibold),
            color: Self.textMuted,
            centerX: nodeX,
            y: baselineY + height * 0.025,
            maxWidth: width * 0.16
          )
        }
      }
      elapsed += max(0.000_001, segment.durationSec)
    }

    let headRadius = max(4, height * 0.0055)
    accent.setFill()
    UIBezierPath(
      ovalIn: CGRect(
        x: traceHeadX - headRadius,
        y: baselineY - headRadius,
        width: headRadius * 2,
        height: headRadius * 2
      )
    ).fill()
  }

  private func drawActiveTraceNode(
    segment: RenderSegment,
    x rawX: CGFloat,
    baselineY: CGFloat,
    state: PulseFrameState,
    cg: CGContext,
    frameWidth width: CGFloat,
    frameHeight height: CGFloat
  ) {
    let liftPhase = min(1, state.segmentProgress / 0.10)
    let remaining = 1 - liftPhase
    let liftEase = 1 - remaining * remaining * remaining
    let lift = height * 0.026 * liftEase
    let cardHeight = height * 0.052
    let measuredWidth = (segment.displayName as NSString).size(
      withAttributes: [
        .font: UIFont.systemFont(ofSize: height * 0.016, weight: .bold)
      ]
    ).width
    let cardWidth = min(width * 0.30, max(width * 0.15, measuredWidth + width * 0.055))
    let centerX = min(width - cardWidth / 2 - width * 0.04, max(cardWidth / 2 + width * 0.04, rawX))
    let centerY = baselineY - lift
    let cardRect = CGRect(
      x: centerX - cardWidth / 2,
      y: centerY - cardHeight / 2,
      width: cardWidth,
      height: cardHeight
    )

    cg.saveGState()
    cg.setLineWidth(max(1, height * 0.0015))
    cg.setStrokeColor(segment.color.withAlphaComponent(0.52).cgColor)
    cg.move(to: CGPoint(x: rawX, y: baselineY))
    cg.addLine(to: CGPoint(x: centerX, y: cardRect.maxY))
    cg.strokePath()
    cg.restoreGState()

    Self.bgTop.withAlphaComponent(0.96).setFill()
    segment.color.withAlphaComponent(0.9).setStroke()
    let card = UIBezierPath(roundedRect: cardRect, cornerRadius: cardHeight * 0.34)
    card.lineWidth = max(2, height * 0.0015)
    card.fill()
    card.stroke()

    drawCentered(
      segment.displayName,
      font: .systemFont(ofSize: height * 0.016, weight: .bold),
      color: Self.textPrimary,
      centerX: centerX,
      y: cardRect.minY + cardHeight * 0.22,
      maxWidth: cardWidth * 0.82
    )

    guard state.onsetEmphasis > 0.001 else { return }
    let ringRadius = height * (0.011 + 0.018 * state.onsetEmphasis)
    segment.color.withAlphaComponent(0.75 * state.onsetEmphasis).setStroke()
    let ring = UIBezierPath(
      ovalIn: CGRect(
        x: rawX - ringRadius,
        y: baselineY - ringRadius,
        width: ringRadius * 2,
        height: ringRadius * 2
      )
    )
    ring.lineWidth = max(2, height * 0.002)
    ring.stroke()
  }

  private func drawKeyboard(
    plan: RenderPlan,
    activeSegment: RenderSegment,
    accent: UIColor,
    rect: CGRect,
    frameHeight height: CGFloat
  ) {
    let keys = KeyboardLayout.layout(
      low: plan.keyboardLow,
      high: plan.keyboardHigh,
      totalWidth: rect.width
    )
    let active = KeyboardLayout.highlighted(
      activeSegment.midiNotes,
      low: plan.keyboardLow,
      high: plan.keyboardHigh
    )
    let blackHeight = rect.height * 0.62

    for key in keys where !key.isBlack {
      let keyRect = CGRect(
        x: rect.minX + key.left,
        y: rect.minY,
        width: key.width,
        height: rect.height
      )
      (active.contains(key.midi) ? accent : Self.whiteKey).setFill()
      UIBezierPath(rect: keyRect).fill()
      Self.blackKey.setStroke()
      let border = UIBezierPath(rect: keyRect)
      border.lineWidth = 1
      border.stroke()
    }

    for key in keys where key.isBlack {
      let keyRect = CGRect(
        x: rect.minX + key.left,
        y: rect.minY,
        width: key.width,
        height: blackHeight
      )
      (active.contains(key.midi) ? accent : Self.blackKey).setFill()
      UIBezierPath(roundedRect: keyRect, cornerRadius: 2).fill()
    }

    if !plan.pitchClassNames.isEmpty {
      for key in keys where active.contains(key.midi) {
        let name = plan.pitchClassNames[KeyboardLayout.pitchClass(key.midi)]
        drawCentered(
          name,
          font: .systemFont(ofSize: height * 0.013, weight: .bold),
          color: accent,
          centerX: rect.minX + key.left + key.width / 2,
          y: rect.minY - height * 0.024,
          maxWidth: key.width * 3
        )
      }
    }
  }

  private static let watermarkLogo: UIImage? = {
    guard let path = Bundle.main.path(forResource: "cp-watermark", ofType: "png") else {
      return nil
    }
    return UIImage(contentsOfFile: path)
  }()

  private func drawWatermark(frameWidth width: CGFloat, frameHeight height: CGFloat) {
    let logoSide = height * 0.046
    let logoRect = CGRect(
      x: (width - logoSide) / 2,
      y: height * 0.89,
      width: logoSide,
      height: logoSide
    )
    if let logo = Self.watermarkLogo, let context = UIGraphicsGetCurrentContext() {
      context.saveGState()
      let clip = UIBezierPath(roundedRect: logoRect, cornerRadius: logoSide * 0.24)
      clip.addClip()
      logo.draw(in: logoRect)
      context.restoreGState()
    }
    drawCentered(
      "Chord Palette",
      font: Self.brandFont(size: height * 0.016),
      color: Self.textPrimary.withAlphaComponent(0.82),
      centerX: width / 2,
      y: logoRect.maxY + height * 0.006,
      maxWidth: width * 0.7
    )
  }

  private static func brandFont(size: CGFloat) -> UIFont {
    for name in ["NotoSansJP-ExtraBold", "NotoSansJP_800ExtraBold", "NotoSansJP-Bold"] {
      if let font = UIFont(name: name, size: size) {
        return font
      }
    }
    return .systemFont(ofSize: size, weight: .heavy)
  }

  private func drawCentered(
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

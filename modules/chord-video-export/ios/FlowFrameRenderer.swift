import CoreGraphics
import UIKit

/// Performance motion visualization. Chord hierarchy comes from segments while
/// falling notes and key landings come from an injected read-only sidecar.
final class FlowFrameRenderer: VideoFrameRendering {
  private static let backgroundTop = UIColor(
    red: 0x11 / 255, green: 0x1a / 255, blue: 0x30 / 255, alpha: 1)
  private static let backgroundMid = UIColor(
    red: 0x08 / 255, green: 0x10 / 255, blue: 0x1f / 255, alpha: 1)
  private static let backgroundBottom = UIColor(
    red: 0x04 / 255, green: 0x07 / 255, blue: 0x0d / 255, alpha: 1)
  private static let textPrimary = UIColor(
    red: 0xee / 255, green: 0xf3 / 255, blue: 0xf8 / 255, alpha: 1)
  private static let textMuted = UIColor(
    red: 0x8e / 255, green: 0x9b / 255, blue: 0xae / 255, alpha: 1)

  private let timeline: FlowVisualNoteTimeline
  private let nonDiatonic: FlowNonDiatonicCycle
  private var cachedKeys: (
    low: Int,
    high: Int,
    width: CGFloat,
    keys: [KeyRect]
  )?

  init(
    timeline: FlowVisualNoteTimeline = .empty,
    nonDiatonic: FlowNonDiatonicCycle = .empty
  ) {
    self.timeline = timeline
    self.nonDiatonic = nonDiatonic
  }

  func makeImage(plan: RenderPlan, timeSec: Double) -> CGImage? {
    let size = CGSize(width: plan.width, height: plan.height)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    let state = FlowFrameStateResolver.resolve(plan: plan, timeSec: timeSec)

    return renderer.image { context in
      draw(
        plan: plan,
        state: state,
        timeSec: timeSec,
        cg: context.cgContext,
        size: size
      )
    }.cgImage
  }

  private func draw(
    plan: RenderPlan,
    state: FlowFrameState,
    timeSec: Double,
    cg: CGContext,
    size: CGSize
  ) {
    let width = size.width
    let height = size.height
    drawBackground(cg: cg, size: size)

    if let current = state.currentSegment {
      let keyboardRect = CGRect(
        x: width * 0.10,
        y: height * 0.71,
        width: width * 0.80,
        height: height * 0.12
      )
      let keys = keyboardKeys(plan: plan, totalWidth: keyboardRect.width)
      let visibleEvents = timeline.visibleEvents(
        at: timeSec,
        lookAheadSec: FlowPerformanceMotionPreset.fallLeadSec,
        postRollSec: FlowPerformanceMotionPreset.landingFadeSec
      )
      FlowFallingBlockRenderer.draw(
        events: visibleEvents,
        plan: plan,
        keys: keys,
        segments: plan.segments,
        fallbackColor: current.color,
        frameTimeSec: timeSec,
        fallTopY: height * 0.14,
        keyboardRect: keyboardRect,
        frameHeight: height
      )
      let aura = auraIntensity(state: state, plan: plan, timeSec: timeSec)
      // Behind the chord hierarchy, so the chord name and its function colour stay on
      // top of the violet rather than inside it.
      FlowNonDiatonicAuraRenderer.drawBackdrop(
        intensity: aura,
        cg: cg,
        frameWidth: width,
        frameHeight: height
      )
      FlowClassicChordStageRenderer.draw(
        plan: plan,
        state: state,
        timeSec: timeSec,
        cg: cg,
        frameWidth: width,
        frameHeight: height,
        nonDiatonic: nonDiatonic,
        auraStrength: aura.current
      )
      FlowNonDiatonicAuraRenderer.drawEdge(
        intensity: aura,
        cg: cg,
        frameWidth: width,
        frameHeight: height
      )
      FlowKeyboardRenderer.draw(
        plan: plan,
        events: visibleEvents,
        keys: keys,
        fallbackColor: current.color,
        frameTimeSec: timeSec,
        rect: keyboardRect,
        frameHeight: height,
        aura: aura,
        cg: cg
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

    drawHeader(plan: plan, frameWidth: width, frameHeight: height)
    if plan.watermark {
      FlowBrandRenderer.draw(frameWidth: width, frameHeight: height)
    }
  }

  /// How strongly the violet aura reads now, from the same eased transition and beat
  /// pulse the chord hero already uses. No separate clock, so the aura cannot drift out
  /// of step with the audio.
  private func auraIntensity(
    state: FlowFrameState,
    plan: RenderPlan,
    timeSec: Double
  ) -> FlowNonDiatonicAuraIntensity {
    guard !nonDiatonic.isEmpty, let current = state.currentSegment else {
      return FlowNonDiatonicAuraIntensity(current: 0, incoming: 0)
    }
    let beatDuration = 60.0 / Double(max(1, plan.bpm))
    let beatPhase = (timeSec / beatDuration).truncatingRemainder(dividingBy: 1.0)
    let pulse = CGFloat(exp(-beatPhase * 3.2))
    let transition = min(0.16, current.durationSec * 0.45)
    let chordProgress = CGFloat(
      min(1.0, max(0.0, (timeSec - current.startSec) / max(0.03, transition)))
    )
    let ease = 1 - pow(1 - chordProgress, 3)
    let count = max(1, state.cycleSegments.count)
    let nextCycleIndex = (state.currentCycleIndex + 1) % count

    return FlowNonDiatonicAuraIntensity.resolve(
      currentIsNonDiatonic: nonDiatonic.contains(cycleIndex: state.currentCycleIndex),
      nextIsNonDiatonic: nonDiatonic.contains(cycleIndex: nextCycleIndex),
      ease: ease,
      pulse: pulse,
      segmentProgress: state.segmentProgress
    )
  }

  private func keyboardKeys(plan: RenderPlan, totalWidth: CGFloat) -> [KeyRect] {
    if let cache = cachedKeys,
      cache.low == plan.keyboardLow,
      cache.high == plan.keyboardHigh,
      cache.width == totalWidth
    {
      return cache.keys
    }
    let keys = KeyboardLayout.layout(
      low: plan.keyboardLow,
      high: plan.keyboardHigh,
      totalWidth: totalWidth
    )
    cachedKeys = (plan.keyboardLow, plan.keyboardHigh, totalWidth, keys)
    return keys
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
      "BPM \(plan.bpm)",
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

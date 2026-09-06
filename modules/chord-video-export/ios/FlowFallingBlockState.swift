import CoreGraphics

/// Internal visual targets. They never alter note timing from the sidecar.
enum FlowPerformanceMotionPreset {
  static let fallLeadSec = 1.25
  static let landingAttackSec = 0.08
  static let landingFadeSec = 0.08
  static let minBlockHeightRatio: CGFloat = 0.018
  static let maxBlockHeightRatio: CGFloat = 0.10
  static let blockWidthRatio: CGFloat = 0.72
}

struct FlowFallingBlockState {
  let event: FlowVisualNoteEvent
  let rect: CGRect
  let opacity: CGFloat
}

enum FlowFallingBlockStateResolver {
  /// Resolves one block so its bottom is exactly on the keyboard top at note.startSec.
  static func resolve(
    event: FlowVisualNoteEvent,
    key: KeyRect,
    frameTimeSec: Double,
    laneOriginX: CGFloat,
    fallTopY: CGFloat,
    keyboardTopY: CGFloat,
    frameHeight: CGFloat
  ) -> FlowFallingBlockState? {
    let travelHeight = max(1, keyboardTopY - fallTopY)
    let pixelsPerSecond = travelHeight / CGFloat(FlowPerformanceMotionPreset.fallLeadSec)
    let secondsUntilLanding = CGFloat(event.startSec - frameTimeSec)
    let blockBottomY = keyboardTopY - secondsUntilLanding * pixelsPerSecond
    let rawHeight = CGFloat(event.durationSec) * pixelsPerSecond
    let blockHeight = min(
      frameHeight * FlowPerformanceMotionPreset.maxBlockHeightRatio,
      max(frameHeight * FlowPerformanceMotionPreset.minBlockHeightRatio, rawHeight)
    )
    let visibleTop = max(fallTopY, blockBottomY - blockHeight)
    let visibleBottom = min(keyboardTopY, blockBottomY)
    guard visibleBottom > visibleTop else { return nil }

    let width = key.width * FlowPerformanceMotionPreset.blockWidthRatio
    let centerX = laneOriginX + key.left + key.width / 2
    let velocityUnit = CGFloat(min(127, max(1, event.velocity)) - 1) / 126
    let opacity = 0.90 + velocityUnit * 0.08
    return FlowFallingBlockState(
      event: event,
      rect: CGRect(
        x: centerX - width / 2,
        y: visibleTop,
        width: width,
        height: visibleBottom - visibleTop
      ),
      opacity: opacity
    )
  }

  /// Attack glow -> soft sustain -> fade, driven only by the note's exact seconds.
  static func landingIntensity(
    event: FlowVisualNoteEvent,
    frameTimeSec: Double
  ) -> CGFloat {
    let age = frameTimeSec - event.startSec
    guard age >= 0 else { return 0 }

    let duration = max(0, event.durationSec)
    let attackEnd = min(FlowPerformanceMotionPreset.landingAttackSec, duration)
    if attackEnd > 0, age <= attackEnd + 0.000_000_001 {
      return CGFloat(1 - 0.45 * age / attackEnd)
    }
    if age <= duration {
      let sustainProgress = duration > 0 ? age / duration : 1
      return CGFloat(max(0.22, 0.55 * (1 - sustainProgress)))
    }

    let fadeAge = age - duration
    guard fadeAge <= FlowPerformanceMotionPreset.landingFadeSec else { return 0 }
    return CGFloat(0.22 * (1 - fadeAge / FlowPerformanceMotionPreset.landingFadeSec))
  }
}

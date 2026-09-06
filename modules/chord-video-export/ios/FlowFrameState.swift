import CoreGraphics

/// Phase V4 design targets live in one place so rendering code never repeats magic values.
enum FlowStylePreset {
  static let handoffStartNormalized: CGFloat = 0.70
  static let arrivalEndNormalized: CGFloat = 0.10

  static let stableCurrentOpacity: CGFloat = 1.00
  static let boundaryCurrentOpacity: CGFloat = 0.86
  static let stableNextOpacity: CGFloat = 0.68
  static let boundaryNextOpacity: CGFloat = 0.76

  static let stableCurrentScale: CGFloat = 1.00
  static let boundaryCurrentScale: CGFloat = 0.88
  static let arrivalNextScale: CGFloat = 0.30
  static let stableNextScale: CGFloat = 0.55
  static let boundaryNextScale: CGFloat = 0.78

  static let stableCurrentX: CGFloat = 0.31
  static let boundaryCurrentX: CGFloat = 0.20
  static let arrivalNextX: CGFloat = 0.88
  static let stableNextX: CGFloat = 0.76
  static let boundaryNextX: CGFloat = 0.58
  static let currentY: CGFloat = 0.215
  static let arrivalNextY: CGFloat = 0.290
  static let stableNextY: CGFloat = 0.255
  static let boundaryNextY: CGFloat = 0.215

  static let stableGlowIntensity: CGFloat = 0.22
  static let peakGlowIntensity: CGFloat = 0.30

  static func smoothstep(_ value: CGFloat) -> CGFloat {
    let x = min(1, max(0, value))
    return x * x * (3 - 2 * x)
  }
}

/// Segment-derived presentation state for a single deterministic Flow frame.
struct FlowFrameState {
  let cycleSegments: [RenderSegment]
  let previousSegment: RenderSegment?
  let currentSegment: RenderSegment?
  let nextSegment: RenderSegment?
  let followingSegment: RenderSegment?
  let currentCycleIndex: Int
  let segmentProgress: CGFloat
  let arrivalProgress: CGFloat
  let handoffProgress: CGFloat
  let currentOpacity: CGFloat
  let nextOpacity: CGFloat
  let currentScale: CGFloat
  let nextScale: CGFloat
  let currentX: CGFloat
  let nextX: CGFloat
  let currentY: CGFloat
  let nextY: CGFloat
  let pathProgress: CGFloat
  let glowIntensity: CGFloat
  let motionEnabled: Bool
}

/// Resolves visual continuity from RenderPlan.segments only.
///
/// No BPM, frame counter, timer, audio analysis, or independent timeline is allowed here.
enum FlowFrameStateResolver {
  static func resolve(plan: RenderPlan, timeSec: Double) -> FlowFrameState {
    let cycleSegments: [RenderSegment] = {
      if plan.chordsPerCycle > 0 {
        return Array(plan.segments.prefix(plan.chordsPerCycle))
      }
      return plan.segments
    }()

    guard !plan.segments.isEmpty, !cycleSegments.isEmpty else {
      return emptyState(cycleSegments: cycleSegments)
    }

    let globalIndex =
      plan.segments.firstIndex(where: {
        timeSec >= $0.startSec && timeSec < $0.startSec + $0.durationSec
      }) ?? max(0, plan.segments.count - 1)
    let currentSegment = plan.segments[globalIndex]
    let currentCycleIndex = globalIndex % cycleSegments.count
    let safeDuration = max(0.000_001, currentSegment.durationSec)
    let rawProgress = (timeSec - currentSegment.startSec) / safeDuration
    let segmentProgress = CGFloat(min(1, max(0, rawProgress)))
    let motionEnabled = cycleSegments.count > 1

    let arrivalLinear =
      segmentProgress / max(0.000_001, FlowStylePreset.arrivalEndNormalized)
    let arrivalProgress = motionEnabled ? FlowStylePreset.smoothstep(arrivalLinear) : 1
    let handoffLinear =
      (segmentProgress - FlowStylePreset.handoffStartNormalized)
      / max(0.000_001, 1 - FlowStylePreset.handoffStartNormalized)
    let handoffProgress = motionEnabled ? FlowStylePreset.smoothstep(handoffLinear) : 0

    let previousIndex =
      (currentCycleIndex - 1 + cycleSegments.count) % cycleSegments.count
    let nextIndex = (currentCycleIndex + 1) % cycleSegments.count
    let followingIndex = (currentCycleIndex + 2) % cycleSegments.count

    let previousSegment =
      motionEnabled && cycleSegments.count > 2 ? cycleSegments[previousIndex] : nil
    let nextSegment = motionEnabled ? cycleSegments[nextIndex] : nil
    let followingSegment =
      cycleSegments.count > 3 ? cycleSegments[followingIndex] : nil

    let arrivedCurrentOpacity = interpolate(
      FlowStylePreset.boundaryCurrentOpacity,
      FlowStylePreset.stableCurrentOpacity,
      arrivalProgress
    )
    let currentOpacity = interpolate(
      arrivedCurrentOpacity,
      FlowStylePreset.boundaryCurrentOpacity,
      handoffProgress
    )
    let arrivedCurrentScale = interpolate(
      FlowStylePreset.boundaryCurrentScale,
      FlowStylePreset.stableCurrentScale,
      arrivalProgress
    )
    let currentScale = interpolate(
      arrivedCurrentScale,
      FlowStylePreset.boundaryCurrentScale,
      handoffProgress
    )

    let introducedNextOpacity = interpolate(
      0,
      FlowStylePreset.stableNextOpacity,
      arrivalProgress
    )
    let nextOpacity =
      nextSegment.map { _ in
        interpolate(
          introducedNextOpacity,
          FlowStylePreset.boundaryNextOpacity,
          handoffProgress
        )
      } ?? 0
    let introducedNextScale = interpolate(
      FlowStylePreset.arrivalNextScale,
      FlowStylePreset.stableNextScale,
      arrivalProgress
    )
    let nextScale =
      nextSegment.map { _ in
        interpolate(
          introducedNextScale,
          FlowStylePreset.boundaryNextScale,
          handoffProgress
        )
      } ?? FlowStylePreset.arrivalNextScale

    let arrivedCurrentX = interpolate(
      FlowStylePreset.boundaryNextX,
      FlowStylePreset.stableCurrentX,
      arrivalProgress
    )
    let currentX =
      motionEnabled
      ? interpolate(arrivedCurrentX, FlowStylePreset.boundaryCurrentX, handoffProgress)
      : 0.50
    let introducedNextX = interpolate(
      FlowStylePreset.arrivalNextX,
      FlowStylePreset.stableNextX,
      arrivalProgress
    )
    let nextX =
      nextSegment.map { _ in
        interpolate(introducedNextX, FlowStylePreset.boundaryNextX, handoffProgress)
      } ?? 0.50
    let introducedNextY = interpolate(
      FlowStylePreset.arrivalNextY,
      FlowStylePreset.stableNextY,
      arrivalProgress
    )
    let nextY =
      nextSegment.map { _ in
        interpolate(introducedNextY, FlowStylePreset.boundaryNextY, handoffProgress)
      } ?? FlowStylePreset.currentY

    let transitionEnergy = max(1 - arrivalProgress, handoffProgress)
    let glowIntensity =
      motionEnabled
      ? interpolate(
        FlowStylePreset.stableGlowIntensity,
        FlowStylePreset.peakGlowIntensity,
        transitionEnergy
      )
      : 0

    return FlowFrameState(
      cycleSegments: cycleSegments,
      previousSegment: previousSegment,
      currentSegment: currentSegment,
      nextSegment: nextSegment,
      followingSegment: followingSegment,
      currentCycleIndex: currentCycleIndex,
      segmentProgress: segmentProgress,
      arrivalProgress: arrivalProgress,
      handoffProgress: handoffProgress,
      currentOpacity: currentOpacity,
      nextOpacity: nextOpacity,
      currentScale: currentScale,
      nextScale: nextScale,
      currentX: currentX,
      nextX: nextX,
      currentY: FlowStylePreset.currentY,
      nextY: nextY,
      pathProgress: motionEnabled ? FlowStylePreset.smoothstep(segmentProgress) : 0,
      glowIntensity: glowIntensity,
      motionEnabled: motionEnabled
    )
  }

  private static func interpolate(_ from: CGFloat, _ to: CGFloat, _ progress: CGFloat) -> CGFloat {
    from + (to - from) * min(1, max(0, progress))
  }

  private static func emptyState(cycleSegments: [RenderSegment]) -> FlowFrameState {
    FlowFrameState(
      cycleSegments: cycleSegments,
      previousSegment: nil,
      currentSegment: nil,
      nextSegment: nil,
      followingSegment: nil,
      currentCycleIndex: 0,
      segmentProgress: 0,
      arrivalProgress: 0,
      handoffProgress: 0,
      currentOpacity: 0,
      nextOpacity: 0,
      currentScale: FlowStylePreset.stableCurrentScale,
      nextScale: FlowStylePreset.arrivalNextScale,
      currentX: 0.50,
      nextX: 0.50,
      currentY: FlowStylePreset.currentY,
      nextY: FlowStylePreset.currentY,
      pathProgress: 0,
      glowIntensity: 0,
      motionEnabled: false
    )
  }
}

import CoreGraphics

/// Phase V4 design targets live in one place so rendering code never repeats magic values.
enum FlowStylePreset {
  static let handoffStartNormalized: CGFloat = 0.70
  static let entrySettleEndNormalized: CGFloat = 0.10

  static let currentOpacity: CGFloat = 1.00
  static let boundaryCurrentOpacity: CGFloat = 0.76
  static let adjacentOpacity: CGFloat = 0.62
  static let boundaryAdjacentOpacity: CGFloat = 0.75

  static let currentScale: CGFloat = 1.02
  static let boundaryCurrentScale: CGFloat = 0.991
  static let adjacentScale: CGFloat = 0.97
  static let boundaryAdjacentScale: CGFloat = 0.99

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
  let currentCycleIndex: Int
  let segmentProgress: CGFloat
  let entryProgress: CGFloat
  let handoffProgress: CGFloat
  let previousOpacity: CGFloat
  let currentOpacity: CGFloat
  let nextOpacity: CGFloat
  let previousScale: CGFloat
  let currentScale: CGFloat
  let nextScale: CGFloat
  let previousX: CGFloat
  let currentX: CGFloat
  let nextX: CGFloat
  let glowProgress: CGFloat
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

    let entryLinear =
      segmentProgress / max(0.000_001, FlowStylePreset.entrySettleEndNormalized)
    let entryProgress = motionEnabled ? FlowStylePreset.smoothstep(entryLinear) : 1
    let handoffLinear =
      (segmentProgress - FlowStylePreset.handoffStartNormalized)
      / max(0.000_001, 1 - FlowStylePreset.handoffStartNormalized)
    let handoffProgress = motionEnabled ? FlowStylePreset.smoothstep(handoffLinear) : 0

    let previousIndex =
      (currentCycleIndex - 1 + cycleSegments.count) % cycleSegments.count
    let nextIndex = (currentCycleIndex + 1) % cycleSegments.count

    // With two chords previous and next are the same event. Keep only the next
    // representation so Flow never renders a duplicate visual label.
    let previousSegment =
      motionEnabled && cycleSegments.count > 2 ? cycleSegments[previousIndex] : nil
    let nextSegment = motionEnabled ? cycleSegments[nextIndex] : nil

    let settledCurrentOpacity = interpolate(
      FlowStylePreset.boundaryCurrentOpacity,
      FlowStylePreset.currentOpacity,
      entryProgress
    )
    let currentOpacity = interpolate(
      settledCurrentOpacity,
      FlowStylePreset.boundaryCurrentOpacity,
      handoffProgress
    )
    let settledCurrentScale = interpolate(
      FlowStylePreset.boundaryCurrentScale,
      FlowStylePreset.currentScale,
      entryProgress
    )
    let currentScale = interpolate(
      settledCurrentScale,
      FlowStylePreset.boundaryCurrentScale,
      handoffProgress
    )

    let settledPreviousOpacity = interpolate(
      FlowStylePreset.boundaryAdjacentOpacity,
      FlowStylePreset.adjacentOpacity,
      entryProgress
    )
    let previousOpacity = previousSegment.map { _ in
      interpolate(
        settledPreviousOpacity,
        0,
        handoffProgress
      )
    } ?? 0
    let settledPreviousScale = interpolate(
      FlowStylePreset.boundaryAdjacentScale,
      FlowStylePreset.adjacentScale,
      entryProgress
    )
    let previousScale = previousSegment.map { _ in
      interpolate(
        settledPreviousScale,
        FlowStylePreset.adjacentScale,
        handoffProgress
      )
    } ?? FlowStylePreset.adjacentScale

    let introducedNextOpacity = interpolate(
      0,
      FlowStylePreset.adjacentOpacity,
      entryProgress
    )
    let nextOpacity =
      nextSegment.map { _ in
        interpolate(
          introducedNextOpacity,
          FlowStylePreset.boundaryAdjacentOpacity,
          handoffProgress
        )
      } ?? 0
    let introducedNextScale = interpolate(
      FlowStylePreset.adjacentScale,
      FlowStylePreset.adjacentScale,
      entryProgress
    )
    let nextScale =
      nextSegment.map { _ in
        interpolate(
          introducedNextScale,
          FlowStylePreset.boundaryAdjacentScale,
          handoffProgress
        )
      } ?? FlowStylePreset.adjacentScale

    // Current remains strictly more prominent than Next before the boundary:
    // opacity 0.76 > 0.75 and scale 0.991 > 0.99.
    let previousX: CGFloat = 0.17
    let currentX: CGFloat = 0.50
    let nextX: CGFloat = 0.83

    // The glow reaches the same bridge point immediately before and after a
    // boundary, then settles onto the newly-current chord without a position jump.
    let glowProgress: CGFloat = {
      guard motionEnabled else { return 0 }
      if segmentProgress < FlowStylePreset.entrySettleEndNormalized {
        return 0.5 * (1 - entryProgress)
      }
      return 0.5 * handoffProgress
    }()

    return FlowFrameState(
      cycleSegments: cycleSegments,
      previousSegment: previousSegment,
      currentSegment: currentSegment,
      nextSegment: nextSegment,
      currentCycleIndex: currentCycleIndex,
      segmentProgress: segmentProgress,
      entryProgress: entryProgress,
      handoffProgress: handoffProgress,
      previousOpacity: previousOpacity,
      currentOpacity: currentOpacity,
      nextOpacity: nextOpacity,
      previousScale: previousScale,
      currentScale: currentScale,
      nextScale: nextScale,
      previousX: previousX,
      currentX: currentX,
      nextX: nextX,
      glowProgress: glowProgress,
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
      currentCycleIndex: 0,
      segmentProgress: 0,
      entryProgress: 0,
      handoffProgress: 0,
      previousOpacity: 0,
      currentOpacity: 0,
      nextOpacity: 0,
      previousScale: FlowStylePreset.adjacentScale,
      currentScale: FlowStylePreset.currentScale,
      nextScale: FlowStylePreset.adjacentScale,
      previousX: 0.17,
      currentX: 0.50,
      nextX: 0.83,
      glowProgress: 0,
      motionEnabled: false
    )
  }
}

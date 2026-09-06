import CoreGraphics

/// Segment-derived chord-level state. Performance-note timing lives in a separate
/// video-export sidecar.
struct FlowFrameState {
  let cycleSegments: [RenderSegment]
  let previousSegment: RenderSegment?
  let currentSegment: RenderSegment?
  let nextSegment: RenderSegment?
  let followingSegment: RenderSegment?
  let currentCycleIndex: Int
  let segmentProgress: CGFloat
}

enum FlowFrameStateResolver {
  static func resolve(plan: RenderPlan, timeSec: Double) -> FlowFrameState {
    let cycleSegments: [RenderSegment] = {
      if plan.chordsPerCycle > 0 {
        return Array(plan.segments.prefix(plan.chordsPerCycle))
      }
      return plan.segments
    }()

    guard !plan.segments.isEmpty, !cycleSegments.isEmpty else {
      return FlowFrameState(
        cycleSegments: cycleSegments,
        previousSegment: nil,
        currentSegment: nil,
        nextSegment: nil,
        followingSegment: nil,
        currentCycleIndex: 0,
        segmentProgress: 0
      )
    }

    let globalIndex =
      plan.segments.firstIndex(where: {
        timeSec >= $0.startSec && timeSec < $0.startSec + $0.durationSec
      }) ?? max(0, plan.segments.count - 1)
    let currentSegment = plan.segments[globalIndex]
    let currentCycleIndex = globalIndex % cycleSegments.count
    let safeDuration = max(0.000_001, currentSegment.durationSec)
    let progress = (timeSec - currentSegment.startSec) / safeDuration
    let segmentProgress = CGFloat(min(1, max(0, progress)))
    let hasNext = cycleSegments.count > 1

    let previousIndex = (currentCycleIndex - 1 + cycleSegments.count) % cycleSegments.count
    let nextIndex = (currentCycleIndex + 1) % cycleSegments.count
    let followingIndex = (currentCycleIndex + 2) % cycleSegments.count

    return FlowFrameState(
      cycleSegments: cycleSegments,
      previousSegment: hasNext && cycleSegments.count > 2
        ? cycleSegments[previousIndex]
        : nil,
      currentSegment: currentSegment,
      nextSegment: hasNext ? cycleSegments[nextIndex] : nil,
      followingSegment: cycleSegments.count > 3 ? cycleSegments[followingIndex] : nil,
      currentCycleIndex: currentCycleIndex,
      segmentProgress: segmentProgress
    )
  }
}

import CoreGraphics

/// Segment-derived visual state for one Pulse frame.
struct PulseFrameState {
  let activeSegment: RenderSegment?
  let cycleSegments: [RenderSegment]
  let activeCycleIndex: Int
  let segmentProgress: CGFloat
  let traceProgress: CGFloat
  let onsetEmphasis: CGFloat
}

/// Converts the exported segment timeline into Pulse-only visual state.
/// Musical timing comes exclusively from segment start/duration values.
enum PulseFrameStateResolver {
  static func resolve(plan: RenderPlan, timeSec: Double) -> PulseFrameState {
    let cycleSegments: [RenderSegment] = {
      if plan.chordsPerCycle > 0 {
        return Array(plan.segments.prefix(plan.chordsPerCycle))
      }
      return plan.segments
    }()

    guard !plan.segments.isEmpty, !cycleSegments.isEmpty else {
      return PulseFrameState(
        activeSegment: nil,
        cycleSegments: cycleSegments,
        activeCycleIndex: 0,
        segmentProgress: 0,
        traceProgress: 0,
        onsetEmphasis: 0
      )
    }

    let globalIndex =
      plan.segments.firstIndex(where: {
        timeSec >= $0.startSec && timeSec < $0.startSec + $0.durationSec
      }) ?? max(0, plan.segments.count - 1)
    let activeSegment = plan.segments[globalIndex]
    let activeCycleIndex = globalIndex % cycleSegments.count
    let safeDuration = max(0.000_001, activeSegment.durationSec)
    let rawSegmentProgress = (timeSec - activeSegment.startSec) / safeDuration
    let segmentProgress = CGFloat(min(1, max(0, rawSegmentProgress)))

    let cycleDuration = cycleSegments.reduce(0.0) {
      $0 + max(0.000_001, $1.durationSec)
    }
    let completedBeforeActive = cycleSegments.prefix(activeCycleIndex).reduce(0.0) {
      $0 + max(0.000_001, $1.durationSec)
    }
    let activeCycleDuration = max(0.000_001, cycleSegments[activeCycleIndex].durationSec)
    let elapsedInCycle =
      completedBeforeActive + activeCycleDuration * Double(segmentProgress)
    let traceProgress = CGFloat(min(1, max(0, elapsedInCycle / max(0.000_001, cycleDuration))))

    // Onset focus occupies the first 12% of the active segment; no tempo conversion.
    let onsetPhase = min(1, segmentProgress / 0.12)
    let onsetDecay = 1 - onsetPhase
    let onsetEmphasis = onsetDecay * onsetDecay

    return PulseFrameState(
      activeSegment: activeSegment,
      cycleSegments: cycleSegments,
      activeCycleIndex: activeCycleIndex,
      segmentProgress: segmentProgress,
      traceProgress: traceProgress,
      onsetEmphasis: onsetEmphasis
    )
  }
}

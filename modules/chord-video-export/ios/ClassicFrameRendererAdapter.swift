import CoreGraphics

/// Preserves the frozen Classic renderer behind the shared renderer strategy.
struct ClassicFrameRendererAdapter: VideoFrameRendering {
  func makeImage(plan: RenderPlan, timeSec: Double) -> CGImage? {
    FrameRenderer.makeImage(plan: plan, timeSec: timeSec)
  }
}

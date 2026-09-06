import CoreGraphics

/// Strategy boundary between the shared encoder and one visual rendering style.
protocol VideoFrameRendering {
  func makeImage(plan: RenderPlan, timeSec: Double) -> CGImage?
}

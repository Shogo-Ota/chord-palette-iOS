/// Native boundary representation. Unknown values fail closed to Classic.
private enum NativeVideoVisualStyle: String {
  case classic
  case flow

  init(normalizing value: String) {
    self = NativeVideoVisualStyle(rawValue: value) ?? .classic
  }
}

/// Resolves one renderer per export; rendering implementations never branch by style.
enum VideoFrameRendererRegistry {
  static func renderer(
    for value: String,
    templateId: String = "standard",
    compareScene: CompareScene? = nil,
    flowTimeline: FlowVisualNoteTimeline = .empty,
    flowNonDiatonic: FlowNonDiatonicCycle = .empty
  ) -> any VideoFrameRendering {
    if templateId == "compare", let compareScene {
      return CompareFrameRenderer(scene: compareScene)
    }
    switch NativeVideoVisualStyle(normalizing: value) {
    case .flow:
      return FlowFrameRenderer(timeline: flowTimeline, nonDiatonic: flowNonDiatonic)
    case .classic:
      return ClassicFrameRendererAdapter()
    }
  }
}

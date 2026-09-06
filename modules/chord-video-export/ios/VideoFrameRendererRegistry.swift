/// Native boundary representation. Unknown values fail closed to Classic.
private enum NativeVideoVisualStyle: String {
  case classic
  case pulse
  case flow

  init(normalizing value: String) {
    self = NativeVideoVisualStyle(rawValue: value) ?? .classic
  }
}

/// Resolves one renderer per export; rendering implementations never branch by style.
enum VideoFrameRendererRegistry {
  static func renderer(for value: String) -> any VideoFrameRendering {
    switch NativeVideoVisualStyle(normalizing: value) {
    case .pulse:
      return PulseFrameRenderer()
    case .flow:
      return FlowFrameRenderer()
    case .classic:
      return ClassicFrameRendererAdapter()
    }
  }
}

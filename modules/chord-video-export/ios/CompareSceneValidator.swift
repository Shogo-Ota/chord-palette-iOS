enum CompareSceneValidator {
  static func validate(_ scene: CompareScene) -> String? {
    guard scene.sampleRate > 0, scene.sampleRate <= 384_000 else {
      return "invalid sample rate"
    }
    guard scene.durationSamples > 0, scene.fpsNumerator > 0, scene.fpsDenominator > 0 else {
      return "invalid media duration"
    }
    guard !scene.pages.isEmpty, !scene.cues.isEmpty else {
      return "empty compare scene"
    }
    guard
      scene.productName == "Chord Palette",
      scene.motion == "standard" || scene.motion == "reduced"
    else {
      return "invalid compare presentation"
    }
    guard scene.pages.allSatisfy({ !$0.cards.isEmpty && $0.cards.count <= 4 }) else {
      return "invalid compare page"
    }
    guard scene.pages.allSatisfy({ $0.role == "base" || $0.role == "variant" }) else {
      return "invalid compare role"
    }

    var ids = Set<String>()
    var previousStart = -1
    for cue in scene.cues {
      guard ids.insert(cue.id).inserted else { return "duplicate compare cue" }
      guard
        cue.startSample >= 0,
        cue.durationSamples > 0,
        cue.anticipationStartSample >= 0,
        cue.anticipationStartSample <= cue.startSample,
        cue.startSample >= previousStart,
        cue.startSample + cue.durationSamples <= scene.durationSamples
      else {
        return "invalid compare cue range"
      }
      guard
        scene.pages.contains(where: {
          $0.role == cue.role && $0.pageIndex == cue.pageIndex
            && $0.cards.contains(where: { $0.eventId == cue.eventId })
        })
      else {
        return "compare cue has no page card"
      }
      previousStart = cue.startSample
    }
    return nil
  }
}

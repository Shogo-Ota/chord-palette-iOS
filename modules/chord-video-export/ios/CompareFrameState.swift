import Foundation

struct CompareFrameState {
  let sample: Int
  let cue: CompareSceneCue
  let page: CompareScenePage
  let anticipatedCue: CompareSceneCue?
  let revealProgress: Double
  let storyProgress: Double

  static func evaluate(scene: CompareScene, timeSec: Double) -> CompareFrameState? {
    guard let firstCue = scene.cues.first, scene.durationSamples > 0 else { return nil }
    let rawSample = Int(floor(max(0, timeSec) * Double(scene.sampleRate)))
    let sample = min(scene.durationSamples - 1, rawSample)

    var active = firstCue
    for cue in scene.cues {
      if cue.startSample > sample { break }
      active = cue
    }
    guard
      let page = scene.pages.first(where: {
        $0.role == active.role && $0.pageIndex == active.pageIndex
      })
    else {
      return nil
    }
    let anticipated = scene.cues.first(where: {
      $0.changed && $0.anticipationStartSample < $0.startSample
        && sample >= $0.anticipationStartSample && sample < $0.startSample
    })
    let revealSamples = min(
      Int((Double(scene.sampleRate) * 0.24).rounded()),
      Int((Double(active.durationSamples) * 0.5).rounded())
    )
    let reveal: Double
    if active.changed && active.role == "variant" && revealSamples > 0 {
      let linear = min(1, max(0, Double(sample - active.startSample) / Double(revealSamples)))
      reveal = scene.motion == "reduced" ? (linear > 0 ? 1 : 0) : linear
    } else {
      reveal = 1
    }

    return CompareFrameState(
      sample: sample,
      cue: active,
      page: page,
      anticipatedCue: anticipated,
      revealProgress: reveal,
      storyProgress: Double(sample) / Double(scene.durationSamples)
    )
  }
}

import AVFoundation

/// Three-channel mixer (sprint-2.md §5):
///
///   Chord source → chordMixer ┐
///                             ├→ masterMixer (engine.mainMixerNode) → output
///   Drum source  → drumMixer  ┘
///
/// Volume values are the runtime source of truth ONLY; the canonical persisted
/// values live in TypeScript/SQLite (§5.1). Range is clamped to [0, 1].
final class Mixer {
  let chordMixer = AVAudioMixerNode()
  let drumMixer = AVAudioMixerNode()
  private unowned let masterMixer: AVAudioMixerNode

  init(engine: AVAudioEngine) {
    masterMixer = engine.mainMixerNode
    engine.attach(chordMixer)
    engine.attach(drumMixer)
  }

  /// Connect the per-part mixers into the master mixer with the given format.
  func connect(engine: AVAudioEngine, format: AVAudioFormat) {
    engine.connect(chordMixer, to: masterMixer, format: format)
    engine.connect(drumMixer, to: masterMixer, format: format)
  }

  private func clamp(_ value: Float) -> Float {
    return min(1.0, max(0.0, value))
  }

  func setMasterVolume(_ value: Float) {
    masterMixer.outputVolume = clamp(value)
  }

  func setChordVolume(_ value: Float) {
    chordMixer.outputVolume = clamp(value)
  }

  func setDrumVolume(_ value: Float) {
    drumMixer.outputVolume = clamp(value)
  }
}

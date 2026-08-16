import AVFoundation
import Foundation

struct CountInConfigValue {
  let beats: Int
  let midiNote: UInt8
  let velocity: UInt8
  let finalVelocity: UInt8
}

/// Playback-only four-count. A dedicated percussion sampler feeds the master bus,
/// so the cue remains audible when the arrangement's drum mode or drum volume is off.
final class CountInPlayer {
  private let sampler = AVAudioUnitSampler()
  private let queue = DispatchQueue(
    label: "app.chord-palette.count-in",
    qos: .userInteractive
  )
  private let lock = NSLock()
  private var workItems: [DispatchWorkItem] = []
  private var generation: UInt64 = 0
  private var attached = false
  private var loaded = false
  private(set) var lastError: String?

  init(engine: AVAudioEngine) {
    sampler.masterGain = -8
    engine.attach(sampler)
  }

  func attach(engine: AVAudioEngine, masterBus: AVAudioMixerNode, format: AVAudioFormat) {
    guard !attached else { return }
    engine.connect(sampler, to: masterBus, format: format)
    attached = true
  }

  @discardableResult
  func load(soundFontURL: URL) -> Bool {
    if loaded { return true }
    do {
      try sampler.loadSoundBankInstrument(
        at: soundFontURL,
        program: 0,
        bankMSB: UInt8(kAUSampler_DefaultPercussionBankMSB),
        bankLSB: UInt8(kAUSampler_DefaultBankLSB)
      )
      loaded = true
      lastError = nil
      return true
    } catch {
      lastError = "count-in drum bank load failed: \(String(describing: error))"
      return false
    }
  }

  /// Schedule all clicks and the music handoff against one native monotonic clock.
  @discardableResult
  func play(
    config: CountInConfigValue,
    bpm: Double,
    completion: @escaping () -> Void
  ) -> Bool {
    cancel()
    guard attached, loaded, config.beats > 0, bpm > 0 else { return false }

    lock.lock()
    generation += 1
    let activeGeneration = generation
    let origin = DispatchTime.now().uptimeNanoseconds
    lock.unlock()

    let secondsPerBeat = 60.0 / bpm
    for beat in 0..<config.beats {
      let velocity = beat == config.beats - 1 ? config.finalVelocity : config.velocity
      schedule(
        afterSeconds: Double(beat) * secondsPerBeat,
        originNanos: origin,
        generation: activeGeneration
      ) { [weak self] in
        self?.sampler.startNote(config.midiNote, withVelocity: velocity, onChannel: 9)
      }
      schedule(
        afterSeconds: Double(beat) * secondsPerBeat + min(0.08, secondsPerBeat * 0.25),
        originNanos: origin,
        generation: activeGeneration
      ) { [weak self] in
        self?.sampler.stopNote(config.midiNote, onChannel: 9)
      }
    }

    schedule(
      afterSeconds: Double(config.beats) * secondsPerBeat,
      originNanos: origin,
      generation: activeGeneration,
      action: completion
    )
    return true
  }

  func cancel() {
    lock.lock()
    generation += 1
    let pending = workItems
    workItems.removeAll(keepingCapacity: true)
    lock.unlock()
    for item in pending { item.cancel() }
    sampler.sendController(123, withValue: 0, onChannel: 9)
    sampler.sendController(120, withValue: 0, onChannel: 9)
  }

  func teardown(engine: AVAudioEngine) {
    cancel()
    if attached {
      engine.disconnectNodeOutput(sampler)
      engine.detach(sampler)
    }
    attached = false
    loaded = false
  }

  var isReady: Bool { attached && loaded }

  private func schedule(
    afterSeconds: Double,
    originNanos: UInt64,
    generation activeGeneration: UInt64,
    action: @escaping () -> Void
  ) {
    let item = DispatchWorkItem { [weak self] in
      guard let self else { return }
      self.lock.lock()
      let current = self.generation
      self.lock.unlock()
      guard current == activeGeneration else { return }
      action()
    }
    lock.lock()
    workItems.append(item)
    lock.unlock()
    queue.asyncAfter(
      deadline: DispatchTime(uptimeNanoseconds: originNanos)
        + .microseconds(Int(max(0, afterSeconds) * 1_000_000)),
      execute: item
    )
  }
}

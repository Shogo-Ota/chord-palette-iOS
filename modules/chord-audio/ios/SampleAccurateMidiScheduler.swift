import AVFoundation
import AudioToolbox
import os

/// One transport origin shared by the chord and drum render observers.
final class SampleAccurateMidiClock {
  private var unfairLock = os_unfair_lock_s()
  private var originSampleTime: Double?

  func reset() {
    os_unfair_lock_lock(&unfairLock)
    originSampleTime = nil
    os_unfair_lock_unlock(&unfairLock)
  }

  func origin(for timestamp: Double) -> Double {
    os_unfair_lock_lock(&unfairLock)
    if originSampleTime == nil {
      originSampleTime = timestamp
    }
    let result = originSampleTime ?? timestamp
    os_unfair_lock_unlock(&unfairLock)
    return result
  }
}

/// Schedules one sampler's MIDI stream from the audio render clock.
///
/// Dispatch timers are unsuitable for musical time: the OS may wake their queue
/// late under load. This scheduler only submits events for the buffer currently
/// being rendered and supplies an exact frame offset to the Audio Unit.
final class SampleAccurateMidiScheduler {
  struct Diagnostics {
    let available: Bool
    let active: Bool
    let renderedBufferCount: Int
    let scheduledEventCount: Int
    let lateEventCount: Int
    let maximumLateFrames: Int64
  }

  private struct RenderEvent {
    let beat: Double
    let status: UInt8
    let data1: UInt8
    let data2: UInt8
    let source: ScheduledMidiEvent
  }

  private final class State {
    let events: [RenderEvent]
    let framesPerBeat: Double
    let totalBeats: Double
    let looping: Bool
    let startBeat: Double
    var eventIndex: Int
    var loopIndex: Int
    var currentRawBeat: Double
    var renderedBufferCount = 0
    var scheduledEventCount = 0
    var lateEventCount = 0
    var maximumLateFrames: Int64 = 0

    init(
      events: [RenderEvent],
      framesPerBeat: Double,
      totalBeats: Double,
      looping: Bool,
      startBeat: Double
    ) {
      self.events = events
      self.framesPerBeat = framesPerBeat
      self.totalBeats = totalBeats
      self.looping = looping
      self.startBeat = startBeat
      self.currentRawBeat = startBeat

      if let first = events.firstIndex(where: { $0.beat >= startBeat - 0.000_001 }) {
        eventIndex = first
        loopIndex = 0
      } else if looping && !events.isEmpty {
        eventIndex = 0
        loopIndex = 1
      } else {
        eventIndex = events.count
        loopIndex = 0
      }
    }
  }

  private let audioUnit: AUAudioUnit
  private let clock: SampleAccurateMidiClock
  private let shouldSchedule: (ScheduledMidiEvent) -> Bool
  private let onScheduled: (ScheduledMidiEvent) -> Void
  private let scheduleBlock: AUScheduleMIDIEventBlock?
  private var observerToken: Int?
  private var unfairLock = os_unfair_lock_s()
  private var state: State?
  private var lastDiagnostics = Diagnostics(
    available: false,
    active: false,
    renderedBufferCount: 0,
    scheduledEventCount: 0,
    lateEventCount: 0,
    maximumLateFrames: 0
  )

  init(
    sampler: AVAudioUnitSampler,
    clock: SampleAccurateMidiClock,
    shouldSchedule: @escaping (ScheduledMidiEvent) -> Bool = { _ in true },
    onScheduled: @escaping (ScheduledMidiEvent) -> Void = { _ in }
  ) {
    audioUnit = sampler.auAudioUnit
    self.clock = clock
    self.shouldSchedule = shouldSchedule
    self.onScheduled = onScheduled
    scheduleBlock = sampler.auAudioUnit.scheduleMIDIEventBlock
    lastDiagnostics = Diagnostics(
      available: scheduleBlock != nil,
      active: false,
      renderedBufferCount: 0,
      scheduledEventCount: 0,
      lateEventCount: 0,
      maximumLateFrames: 0
    )

    observerToken = audioUnit.token(byAddingRenderObserver: { [weak self] flags, timestamp, frames, _ in
      guard flags.contains(.unitRenderAction_PreRender), let self else { return }
      self.render(timestamp: timestamp.pointee.mSampleTime, frameCount: frames)
    })
  }

  deinit {
    if let observerToken {
      audioUnit.removeRenderObserver(observerToken)
    }
  }

  @discardableResult
  func start(
    events: [ScheduledMidiEvent],
    bpm: Double,
    totalBeats: Double,
    loop: Bool,
    startBeat: Double,
    sampleRate: Double
  ) -> Bool {
    guard scheduleBlock != nil, bpm > 0, totalBeats > 0, sampleRate > 0 else {
      return false
    }

    let normalizedStart: Double
    if loop {
      let folded = max(0, startBeat).truncatingRemainder(dividingBy: totalBeats)
      normalizedStart = folded < 0 ? folded + totalBeats : folded
    } else {
      normalizedStart = max(0, startBeat)
    }
    let renderEvents = events.compactMap(Self.makeRenderEvent).sorted {
      if abs($0.beat - $1.beat) > 0.000_001 { return $0.beat < $1.beat }
      return Self.priority($0.status, $0.data1, $0.data2)
        < Self.priority($1.status, $1.data1, $1.data2)
    }
    let next = State(
      events: renderEvents,
      framesPerBeat: sampleRate * 60.0 / bpm,
      totalBeats: totalBeats,
      looping: loop,
      startBeat: normalizedStart
    )

    os_unfair_lock_lock(&unfairLock)
    state = next
    lastDiagnostics = Diagnostics(
      available: true,
      active: true,
      renderedBufferCount: 0,
      scheduledEventCount: 0,
      lateEventCount: 0,
      maximumLateFrames: 0
    )
    os_unfair_lock_unlock(&unfairLock)
    return true
  }

  func stop() {
    os_unfair_lock_lock(&unfairLock)
    captureDiagnostics(active: false)
    state = nil
    os_unfair_lock_unlock(&unfairLock)
  }

  func currentRawBeat(fallback: Double) -> Double {
    os_unfair_lock_lock(&unfairLock)
    let beat = state?.currentRawBeat ?? fallback
    os_unfair_lock_unlock(&unfairLock)
    return beat
  }

  func diagnostics() -> Diagnostics {
    os_unfair_lock_lock(&unfairLock)
    if state != nil {
      captureDiagnostics(active: true)
    }
    let result = lastDiagnostics
    os_unfair_lock_unlock(&unfairLock)
    return result
  }

  private func render(timestamp: Double, frameCount: AUAudioFrameCount) {
    guard timestamp >= 0, frameCount > 0, let scheduleBlock else { return }

    os_unfair_lock_lock(&unfairLock)
    guard let state else {
      os_unfair_lock_unlock(&unfairLock)
      return
    }

    let origin = clock.origin(for: timestamp)
    let bufferStart = timestamp
    let bufferEnd = timestamp + Double(frameCount)
    state.currentRawBeat =
      state.startBeat + max(0, bufferStart - origin) / state.framesPerBeat
    state.renderedBufferCount += 1

    while let event = nextEvent(state) {
      let absoluteBeat = event.beat + Double(state.loopIndex) * state.totalBeats
      let targetSample = origin + (absoluteBeat - state.startBeat) * state.framesPerBeat
      if targetSample >= bufferEnd { break }

      advance(state)
      guard shouldSchedule(event.source) else { continue }

      let roundedTarget = Int64(targetSample.rounded())
      let roundedStart = Int64(bufferStart.rounded())
      let lateFrames = max(Int64(0), roundedStart - roundedTarget)
      if lateFrames > 0 {
        state.lateEventCount += 1
        state.maximumLateFrames = max(state.maximumLateFrames, lateFrames)
      }
      let offset = max(Int64(0), roundedTarget - roundedStart)
      var bytes = (event.status, event.data1, event.data2)
      withUnsafeBytes(of: &bytes) { raw in
        guard let address = raw.bindMemory(to: UInt8.self).baseAddress else { return }
        scheduleBlock(AUEventSampleTimeImmediate + offset, 0, 3, address)
      }
      state.scheduledEventCount += 1
      onScheduled(event.source)
    }

    captureDiagnostics(active: true)
    os_unfair_lock_unlock(&unfairLock)
  }

  private func nextEvent(_ state: State) -> RenderEvent? {
    guard !state.events.isEmpty, state.eventIndex < state.events.count else { return nil }
    return state.events[state.eventIndex]
  }

  private func advance(_ state: State) {
    state.eventIndex += 1
    guard state.eventIndex >= state.events.count, state.looping else { return }
    state.eventIndex = 0
    state.loopIndex += 1
  }

  private func captureDiagnostics(active: Bool) {
    guard let state else {
      lastDiagnostics = Diagnostics(
        available: scheduleBlock != nil,
        active: false,
        renderedBufferCount: lastDiagnostics.renderedBufferCount,
        scheduledEventCount: lastDiagnostics.scheduledEventCount,
        lateEventCount: lastDiagnostics.lateEventCount,
        maximumLateFrames: lastDiagnostics.maximumLateFrames
      )
      return
    }
    lastDiagnostics = Diagnostics(
      available: scheduleBlock != nil,
      active: active,
      renderedBufferCount: state.renderedBufferCount,
      scheduledEventCount: state.scheduledEventCount,
      lateEventCount: state.lateEventCount,
      maximumLateFrames: state.maximumLateFrames
    )
  }

  private static func makeRenderEvent(_ event: ScheduledMidiEvent) -> RenderEvent? {
    let status: UInt8
    switch event.kind {
    case "on":
      status = 0x90 | (event.channel & 0x0f)
    case "off":
      status = 0x80 | (event.channel & 0x0f)
    case "cc":
      status = 0xb0 | (event.channel & 0x0f)
    default:
      return nil
    }
    return RenderEvent(
      beat: event.beat,
      status: status,
      data1: event.a,
      data2: event.kind == "on" ? max(1, event.b) : event.b,
      source: event
    )
  }

  /// Mirrors the TS canonical ordering at loop boundaries.
  private static func priority(_ status: UInt8, _ data1: UInt8, _ data2: UInt8) -> Int {
    switch status & 0xf0 {
    case 0x80:
      return 0
    case 0xb0 where data1 == 64 && data2 < 64:
      return 1
    case 0xb0:
      return 2
    case 0x90:
      return 3
    default:
      return 4
    }
  }
}

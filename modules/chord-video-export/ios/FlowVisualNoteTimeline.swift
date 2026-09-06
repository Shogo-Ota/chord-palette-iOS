import Foundation

/// Immutable note-level sidecar for Flow. Timing is resolved in TypeScript from
/// the finalized performance; native rendering only reads seconds.
struct FlowVisualNoteEvent {
  let pitch: Int
  let startSec: Double
  let durationSec: Double
  let velocity: Int
}

struct FlowVisualNoteTimeline {
  static let empty = FlowVisualNoteTimeline(events: [])

  let events: [FlowVisualNoteEvent]
  private let maximumDurationSec: Double

  init(events: [FlowVisualNoteEvent]) {
    self.events = events.sorted {
      $0.startSec != $1.startSec
        ? $0.startSec < $1.startSec
        : ($0.pitch != $1.pitch
          ? $0.pitch < $1.pitch
          : ($0.durationSec != $1.durationSec
            ? $0.durationSec < $1.durationSec
            : $0.velocity < $1.velocity))
    }
    maximumDurationSec = events.reduce(0) { max($0, $1.durationSec) }
  }

  /// Binary-bounds the sorted timeline before applying the duration-aware lower edge.
  /// No event is deleted; frames only visit notes intersecting the current viewport.
  func visibleEvents(
    at timeSec: Double,
    lookAheadSec: Double,
    postRollSec: Double
  ) -> [FlowVisualNoteEvent] {
    guard !events.isEmpty else { return [] }

    let lowerStart = timeSec - maximumDurationSec - postRollSec
    let upperStart = timeSec + lookAheadSec
    let lower = lowerBound(for: lowerStart)
    let upper = upperBound(for: upperStart)

    return events[lower..<upper].filter {
      $0.startSec + $0.durationSec + postRollSec >= timeSec
    }
  }

  private func lowerBound(for startSec: Double) -> Int {
    var low = 0
    var high = events.count
    while low < high {
      let middle = (low + high) / 2
      if events[middle].startSec < startSec {
        low = middle + 1
      } else {
        high = middle
      }
    }
    return low
  }

  private func upperBound(for startSec: Double) -> Int {
    var low = 0
    var high = events.count
    while low < high {
      let middle = (low + high) / 2
      if events[middle].startSec <= startSec {
        low = middle + 1
      } else {
        high = middle
      }
    }
    return low
  }
}

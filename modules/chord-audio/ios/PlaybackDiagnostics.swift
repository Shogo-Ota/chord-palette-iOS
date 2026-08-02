import Foundation

/// Playback lifecycle log (implementation_v1.01 Phase 1).
///
/// A small thread-safe ring buffer of timestamped transport / session events
/// (play, pause, stop, plan swap, interruption, route change, instrument swap)
/// plus per-kind counters, so the timeline leading up to a rare failure — the
/// "low notes only" report — can be read back from JS long after it happened.
///
/// `record` is called from control threads only, NEVER the audio thread; the
/// render callback's polyphony numbers are tracked by the controller under its
/// own lock and merged into the snapshot. In Debug builds every event is also
/// echoed to the console; Release builds keep the buffer but stay quiet.
final class PlaybackDiagnostics {
  struct Event {
    let at: Date
    let kind: String
    let detail: String
  }

  private let lock = NSLock()
  private var events: [Event] = []
  private var counters: [String: Int] = [:]
  private static let capacity = 200

  func record(_ kind: String, _ detail: String = "") {
    lock.lock()
    events.append(Event(at: Date(), kind: kind, detail: detail))
    if events.count > Self.capacity {
      events.removeFirst(events.count - Self.capacity)
    }
    counters[kind, default: 0] += 1
    lock.unlock()
    #if DEBUG
    NSLog("[chord-audio] %@ %@", kind, detail)
    #endif
  }

  /// JS-facing snapshot: the recent events (oldest first) and per-kind counts.
  func snapshot() -> [String: Any] {
    lock.lock()
    let recent = events
    let counts = counters
    lock.unlock()
    let fmt = ISO8601DateFormatter()
    fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return [
      "events": recent.map { e in
        ["at": fmt.string(from: e.at), "kind": e.kind, "detail": e.detail]
      },
      "counts": counts,
    ]
  }
}

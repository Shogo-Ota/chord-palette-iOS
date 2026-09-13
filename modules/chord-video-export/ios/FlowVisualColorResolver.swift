import UIKit

/// Maps a visual note to the harmonic segment that owns its audio onset.
///
/// This changes color only. Note timing and geometry remain owned by the immutable
/// FlowVisualNoteTimeline.
enum FlowVisualColorResolver {
  static func color(
    for event: FlowVisualNoteEvent,
    segments: [RenderSegment],
    fallback: UIColor
  ) -> UIColor {
    var lower = 0
    var upper = segments.count
    while lower < upper {
      let middle = lower + (upper - lower) / 2
      if segments[middle].startSec <= event.startSec {
        lower = middle + 1
      } else {
        upper = middle
      }
    }
    let index = lower - 1
    guard index >= 0 else { return fallback }
    let segment = segments[index]
    guard event.startSec < segment.startSec + segment.durationSec else {
      return fallback
    }
    return segment.color
  }
}

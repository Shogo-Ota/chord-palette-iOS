import UIKit

/// Maps a visual note to the harmonic segment whose voicing it plays.
///
/// The owning chord is resolved in TypeScript by the Harmonic Gate binding and carried
/// as `harmonyStartSec`, so an attack pushed slightly ahead of a chord change is drawn
/// in the function it sounds instead of the outgoing one. Payloads without the field
/// fall back to the note's own onset.
///
/// This changes color only. Note timing and geometry remain owned by the immutable
/// FlowVisualNoteTimeline.
enum FlowVisualColorResolver {
  /// Absorbs float drift between a chord onset and its segment boundary.
  private static let boundaryTolerance = 0.001

  static func color(
    for event: FlowVisualNoteEvent,
    segments: [RenderSegment],
    fallback: UIColor
  ) -> UIColor {
    let anchor = event.harmonyStartSec >= 0 ? event.harmonyStartSec : event.startSec
    var lower = 0
    var upper = segments.count
    while lower < upper {
      let middle = lower + (upper - lower) / 2
      if segments[middle].startSec <= anchor + Self.boundaryTolerance {
        lower = middle + 1
      } else {
        upper = middle
      }
    }
    let index = lower - 1
    guard index >= 0 else { return fallback }
    let segment = segments[index]
    guard anchor < segment.startSec + segment.durationSec + Self.boundaryTolerance else {
      return fallback
    }
    return segment.color
  }
}

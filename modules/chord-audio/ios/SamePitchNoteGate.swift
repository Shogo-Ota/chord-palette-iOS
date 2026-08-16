import Foundation

/// Protects a retriggered sampler key from an older overlapping NoteOff.
///
/// Standard MIDI can contain overlapping notes with the same channel + pitch. The
/// Performance snapshot intentionally keeps their individual lifetimes, but
/// `AVAudioUnitSampler.stopNote` has no voice id: an old NoteOff may stop the newer
/// retrigger. Reference counting lets every NoteOn through and sends NoteOff only
/// when the final overlapping lifetime ends.
final class SamePitchNoteGate {
  private struct Key: Hashable {
    let channel: UInt8
    let note: UInt8
  }

  private let lock = NSLock()
  private var active: [Key: Int] = [:]
  private var suppressed = 0
  private var peakDepth = 0

  /// Record a NoteOn and return the number of active lifetimes for this sampler key.
  @discardableResult
  func noteOn(channel: UInt8, note: UInt8) -> Int {
    lock.lock()
    defer { lock.unlock() }
    let key = Key(channel: channel, note: note)
    let depth = (active[key] ?? 0) + 1
    active[key] = depth
    peakDepth = max(peakDepth, depth)
    return depth
  }

  /// True only when this is the final NoteOff for the sampler key.
  func shouldSendNoteOff(channel: UInt8, note: UInt8) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    let key = Key(channel: channel, note: note)
    guard let depth = active[key], depth > 0 else {
      // Preserve legacy behaviour for an unmatched NoteOff.
      return true
    }
    if depth == 1 {
      active.removeValue(forKey: key)
      return true
    }
    active[key] = depth - 1
    suppressed += 1
    return false
  }

  func reset(resetDiagnostics: Bool = true) {
    lock.lock()
    defer { lock.unlock() }
    active.removeAll(keepingCapacity: true)
    if resetDiagnostics {
      suppressed = 0
      peakDepth = 0
    }
  }

  func diagnostics() -> (activeKeys: Int, suppressedNoteOffs: Int, peakDepth: Int) {
    lock.lock()
    defer { lock.unlock() }
    return (active.count, suppressed, peakDepth)
  }
}

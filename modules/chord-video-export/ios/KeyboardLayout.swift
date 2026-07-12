import CoreGraphics
import Foundation

/// Swift port of `src/lib/keyboard.ts` (kept in sync). Pure geometry so the exported
/// video draws the exact same keyboard the in-app preview does.
struct KeyRect {
  let midi: Int
  let isBlack: Bool
  let left: CGFloat
  let width: CGFloat
}

enum KeyboardLayout {
  private static let whitePCs: Set<Int> = [0, 2, 4, 5, 7, 9, 11]

  static func pitchClass(_ midi: Int) -> Int { ((midi % 12) + 12) % 12 }
  static func isBlack(_ midi: Int) -> Bool { !whitePCs.contains(pitchClass(midi)) }

  static func layout(
    low: Int,
    high: Int,
    totalWidth: CGFloat,
    blackWidthRatio: CGFloat = 0.62
  ) -> [KeyRect] {
    guard high >= low else { return [] }
    var whitePos: [Int: CGFloat] = [:]
    var whites: [KeyRect] = []
    var blacks: [KeyRect] = []

    var whiteCount = 0
    for m in low...high where !isBlack(m) { whiteCount += 1 }
    let whiteWidth = whiteCount > 0 ? totalWidth / CGFloat(whiteCount) : totalWidth
    let blackWidth = whiteWidth * blackWidthRatio

    var whiteIndex = 0
    for m in low...high where !isBlack(m) {
      let left = CGFloat(whiteIndex) * whiteWidth
      whitePos[m] = left
      whites.append(KeyRect(midi: m, isBlack: false, left: left, width: whiteWidth))
      whiteIndex += 1
    }
    for m in low...high where isBlack(m) {
      guard let leftWhite = whitePos[m - 1] else { continue }
      let boundary = leftWhite + whiteWidth
      blacks.append(KeyRect(midi: m, isBlack: true, left: boundary - blackWidth / 2, width: blackWidth))
    }
    return whites + blacks
  }

  /// Fold a MIDI note into `[low, high]` by octaves (pitch class preserved).
  static func fold(_ midi: Int, low: Int, high: Int) -> Int {
    var n = midi
    while n < low { n += 12 }
    while n > high { n -= 12 }
    return n
  }

  static func highlighted(_ notes: [Int], low: Int, high: Int) -> Set<Int> {
    Set(notes.map { fold($0, low: low, high: high) })
  }
}

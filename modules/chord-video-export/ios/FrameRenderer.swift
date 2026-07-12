import CoreGraphics
import UIKit

/// A single chord occurrence on the export timeline (mirrors ExportSegment in TS).
struct RenderSegment {
  let displayName: String
  let degreeLabel: String
  let color: UIColor
  let midiNotes: [Int]
  let startSec: Double
  let durationSec: Double
}

/// Everything the renderer needs (mirrors ExportPlan in TS, minus audio/encoding).
struct RenderPlan {
  let width: Int
  let height: Int
  let title: String
  let keyLabel: String
  let bpm: Int
  let bars: Int
  let watermark: Bool
  let keyboardLow: Int
  let keyboardHigh: Int
  let pitchClassNames: [String]
  let segments: [RenderSegment]
}

/// Draws one 9:16 frame of the chord + keyboard visual using UIKit (top-left coords).
/// Composition mirrors `src/app/export.tsx` — dark app-base gradient, big chord name
/// in the chord-function color, degree label, and a highlighted piano keyboard.
enum FrameRenderer {
  // App base gradient (theme tokens: screenGradientTop → screenGradientMid → appBg).
  private static let bgTop = UIColor(red: 0x16 / 255, green: 0x20 / 255, blue: 0x3a / 255, alpha: 1)
  private static let bgMid = UIColor(red: 0x0b / 255, green: 0x10 / 255, blue: 0x20 / 255, alpha: 1)
  private static let bgBot = UIColor(red: 0x07 / 255, green: 0x0a / 255, blue: 0x12 / 255, alpha: 1)
  private static let whiteKey = UIColor(red: 0xe9 / 255, green: 0xed / 255, blue: 0xf5 / 255, alpha: 1)
  private static let blackKey = UIColor(red: 0x0e / 255, green: 0x13 / 255, blue: 0x20 / 255, alpha: 1)
  private static let textPrimary = UIColor(red: 0xee / 255, green: 0xf1 / 255, blue: 0xf6 / 255, alpha: 1)
  private static let textMuted = UIColor(red: 0x9a / 255, green: 0xa3 / 255, blue: 0xb5 / 255, alpha: 1)
  private static let textFaint = UIColor(red: 0x6b / 255, green: 0x76 / 255, blue: 0x88 / 255, alpha: 1)

  static func makeImage(plan: RenderPlan, timeSec: Double) -> CGImage? {
    let size = CGSize(width: plan.width, height: plan.height)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    let image = renderer.image { ctx in
      draw(plan: plan, timeSec: timeSec, cg: ctx.cgContext, size: size)
    }
    return image.cgImage
  }

  private static func draw(plan: RenderPlan, timeSec: Double, cg: CGContext, size: CGSize) {
    let W = size.width
    let H = size.height

    // Background vertical gradient.
    let colors = [bgTop.cgColor, bgMid.cgColor, bgBot.cgColor] as CFArray
    let space = CGColorSpaceCreateDeviceRGB()
    if let grad = CGGradient(colorsSpace: space, colors: colors, locations: [0, 0.55, 1]) {
      cg.drawLinearGradient(
        grad, start: CGPoint(x: 0, y: 0), end: CGPoint(x: 0, y: H), options: [])
    } else {
      bgBot.setFill()
      cg.fill(CGRect(origin: .zero, size: size))
    }

    let seg = activeSegment(plan: plan, timeSec: timeSec)
    let accent = seg?.color ?? textPrimary

    // Title + meta (top).
    drawCentered(
      plan.title, font: .systemFont(ofSize: H * 0.026, weight: .heavy), color: textPrimary,
      centerX: W / 2, y: H * 0.06, maxWidth: W * 0.9)
    let meta = "\(plan.keyLabel) · BPM \(plan.bpm) · \(plan.bars)小節"
    drawCentered(
      meta, font: .systemFont(ofSize: H * 0.016, weight: .semibold), color: textMuted,
      centerX: W / 2, y: H * 0.10, maxWidth: W * 0.9)

    // Big chord name + degree label (upper-middle).
    if let seg = seg {
      drawCentered(
        seg.displayName, font: .systemFont(ofSize: H * 0.085, weight: .black), color: accent,
        centerX: W / 2, y: H * 0.30, maxWidth: W * 0.94)
      drawCentered(
        seg.degreeLabel, font: .systemFont(ofSize: H * 0.030, weight: .bold), color: textPrimary,
        centerX: W / 2, y: H * 0.40, maxWidth: W * 0.9)
    }

    // Keyboard (lower area).
    let kbWidth = W * 0.88
    let kbX = (W - kbWidth) / 2
    let kbHeight = H * 0.16
    let kbY = H * 0.60
    drawKeyboard(
      plan: plan, seg: seg, accent: accent,
      rect: CGRect(x: kbX, y: kbY, width: kbWidth, height: kbHeight), frameHeight: H)

    // Watermark (optional, bottom).
    if plan.watermark {
      drawCentered(
        "Chord Palette", font: .systemFont(ofSize: H * 0.016, weight: .bold),
        color: textPrimary.withAlphaComponent(0.6), centerX: W / 2, y: H * 0.94, maxWidth: W * 0.9)
    }
  }

  private static func drawKeyboard(
    plan: RenderPlan, seg: RenderSegment?, accent: UIColor, rect: CGRect, frameHeight: CGFloat
  ) {
    let keys = KeyboardLayout.layout(
      low: plan.keyboardLow, high: plan.keyboardHigh, totalWidth: rect.width)
    let active: Set<Int> =
      seg.map { KeyboardLayout.highlighted($0.midiNotes, low: plan.keyboardLow, high: plan.keyboardHigh) }
      ?? []

    let blackH = rect.height * 0.62
    let labelFont = UIFont.systemFont(ofSize: frameHeight * 0.014, weight: .bold)

    // White keys.
    for k in keys where !k.isBlack {
      let on = active.contains(k.midi)
      let r = CGRect(x: rect.minX + k.left, y: rect.minY, width: k.width, height: rect.height)
      (on ? accent : whiteKey).setFill()
      UIBezierPath(rect: r).fill()
      blackKey.setStroke()
      let border = UIBezierPath(rect: r)
      border.lineWidth = 1
      border.stroke()
    }
    // Black keys (on top).
    for k in keys where k.isBlack {
      let on = active.contains(k.midi)
      let r = CGRect(x: rect.minX + k.left, y: rect.minY, width: k.width, height: blackH)
      (on ? accent : blackKey).setFill()
      UIBezierPath(roundedRect: r, cornerRadius: 2).fill()
    }

    // Note-name labels above pressed keys.
    if !plan.pitchClassNames.isEmpty {
      for k in keys where active.contains(k.midi) {
        let name = plan.pitchClassNames[KeyboardLayout.pitchClass(k.midi)]
        let cx = rect.minX + k.left + k.width / 2
        drawCentered(
          name, font: labelFont, color: accent, centerX: cx, y: rect.minY - frameHeight * 0.026,
          maxWidth: k.width * 3)
      }
    }

    // Octave markers under each C.
    for k in keys where !k.isBlack && KeyboardLayout.pitchClass(k.midi) == 0 {
      let cx = rect.minX + k.left + k.width / 2
      drawCentered(
        "C\(k.midi / 12 - 1)", font: .systemFont(ofSize: frameHeight * 0.011, weight: .semibold),
        color: textFaint, centerX: cx, y: rect.maxY + frameHeight * 0.006, maxWidth: k.width * 3)
    }
  }

  private static func activeSegment(plan: RenderPlan, timeSec: Double) -> RenderSegment? {
    if plan.segments.isEmpty { return nil }
    for s in plan.segments where timeSec >= s.startSec && timeSec < s.startSec + s.durationSec {
      return s
    }
    return plan.segments.last
  }

  /// Draw text horizontally centered on `centerX`, with its top at `y`.
  private static func drawCentered(
    _ text: String, font: UIFont, color: UIColor, centerX: CGFloat, y: CGFloat, maxWidth: CGFloat
  ) {
    let para = NSMutableParagraphStyle()
    para.alignment = .center
    para.lineBreakMode = .byTruncatingTail
    let attrs: [NSAttributedString.Key: Any] = [
      .font: font, .foregroundColor: color, .paragraphStyle: para,
    ]
    let rect = CGRect(x: centerX - maxWidth / 2, y: y, width: maxWidth, height: font.lineHeight * 1.4)
    (text as NSString).draw(in: rect, withAttributes: attrs)
  }
}

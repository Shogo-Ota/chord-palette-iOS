import CoreGraphics
import UIKit

/// A single chord occurrence on the export timeline (mirrors ExportSegment in TS).
struct RenderSegment {
  let displayName: String
  let degreeLabel: String
  let color: UIColor
  /// Small key-context indicator color; nil for single-key progressions.
  let keyTint: UIColor?
  /// Key name spelled next to the degree (e.g. "G"); nil for single-key progressions.
  let keyName: String?
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
  /// Chords in one progression pass (one dot each). 0 → fall back to time-based.
  let chordsPerCycle: Int
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

    // --- Animation drivers ---------------------------------------------------
    // Beat pulse: a sharp attack on every beat that decays quickly, giving the
    // visuals a rhythmic "heartbeat" locked to the song's tempo.
    let bpm = Double(max(1, plan.bpm))
    let beatDur = 60.0 / bpm
    let beatPhase = (timeSec / beatDur).truncatingRemainder(dividingBy: 1.0)
    let pulse = CGFloat(exp(-beatPhase * 3.2))
    // Chord-change transition: fade + settle whenever a new chord starts, so
    // switches glide in instead of hard-cutting. The window is normally ~160 ms
    // but is clamped to ~45% of the chord's own length, so short ½/¼-bar chords
    // (down to a single beat at high tempo) still fully "land" before the next
    // one — no perpetually-dim strobing on fast progressions.
    let chordAge = seg.map { timeSec - $0.startSec } ?? 1.0
    let segDur = seg?.durationSec ?? 1.0
    let transition = min(0.16, segDur * 0.45)
    let chordT = CGFloat(min(1.0, max(0.0, chordAge / max(0.03, transition))))
    let ease = 1 - pow(1 - chordT, 3)  // easeOutCubic

    // Ambient accent glow behind the chord name, breathing with the beat.
    if seg != nil {
      drawRadialGlow(
        cg, center: CGPoint(x: W / 2, y: H * 0.33), radius: W * 0.62,
        color: accent, alpha: (0.16 + 0.14 * pulse) * ease)
    }

    // Title + meta (top).
    drawCentered(
      plan.title, font: .systemFont(ofSize: H * 0.026, weight: .heavy), color: textPrimary,
      centerX: W / 2, y: H * 0.06, maxWidth: W * 0.9)
    let meta = "\(plan.keyLabel) · BPM \(plan.bpm) · \(plan.bars)小節"
    drawCentered(
      meta, font: .systemFont(ofSize: H * 0.016, weight: .semibold), color: textMuted,
      centerX: W / 2, y: H * 0.10, maxWidth: W * 0.9)

    // Big chord name + degree label (upper-middle) — pulses on the beat, glows in
    // the chord-function color, and slides up as each chord begins.
    if let seg = seg {
      let slide = (1 - ease) * H * 0.03
      drawCenteredScaled(
        seg.displayName, font: .systemFont(ofSize: H * 0.085, weight: .black), color: accent,
        centerX: W / 2, y: H * 0.30 + slide, maxWidth: W * 0.94,
        scale: 1.0 + 0.045 * pulse * ease, glowColor: accent,
        glowRadius: H * 0.02 * (0.5 + pulse), alpha: ease)
      let degFont = UIFont.systemFont(ofSize: H * 0.030, weight: .bold)
      let degY = H * 0.40 + slide * 0.5
      // On a modulating video, spell the key next to the degree — "Ⅴ (G)" — so the
      // viewer always knows which key each degree is read in. Single-key videos
      // keep just the degree (no ambiguity, stays clean).
      let degreeDisplay = seg.keyName.map { "\(seg.degreeLabel) (\($0))" } ?? seg.degreeLabel
      drawCentered(
        degreeDisplay, font: degFont,
        color: textPrimary.withAlphaComponent(ease),
        centerX: W / 2, y: degY, maxWidth: W * 0.9)

      // Small key-context dot just left of the degree label — only present when the
      // progression modulates (multi-key), so single-key videos stay clean.
      if let tint = seg.keyTint {
        let degW = min(W * 0.9, (degreeDisplay as NSString).size(withAttributes: [.font: degFont]).width)
        let dotR = H * 0.009
        let dotCenterX = W / 2 - degW / 2 - dotR * 2.2
        let dotCenterY = degY + degFont.lineHeight * 0.5
        let dotRect = CGRect(x: dotCenterX - dotR, y: dotCenterY - dotR, width: dotR * 2, height: dotR * 2)
        tint.withAlphaComponent(ease).setFill()
        UIBezierPath(ovalIn: dotRect).fill()
      }
    }

    // Progression dots with a gliding, glowing active puck.
    drawProgressionDots(
      plan: plan, timeSec: timeSec, centerY: H * 0.50, frameWidth: W, frameHeight: H,
      ease: ease, pulse: pulse)

    // Keyboard (lower area) — active keys fade in and bloom on the beat.
    let kbWidth = W * 0.88
    let kbX = (W - kbWidth) / 2
    let kbHeight = H * 0.16
    let kbY = H * 0.60
    drawKeyboard(
      plan: plan, seg: seg, accent: accent,
      rect: CGRect(x: kbX, y: kbY, width: kbWidth, height: kbHeight), frameHeight: H,
      highlightT: ease, pulse: pulse)

    // Watermark (optional, bottom): palette logo above the wordmark.
    if plan.watermark {
      drawWatermark(cg: cg, frameWidth: W, frameHeight: H)
    }
  }

  /// Cached palette logo bundled with the module (real app icon glyph).
  private static let watermarkLogo: UIImage? = {
    if let path = Bundle.main.path(forResource: "cp-watermark", ofType: "png") {
      return UIImage(contentsOfFile: path)
    }
    return nil
  }()

  /// Layout ①: palette icon (rounded badge) centered, wordmark directly beneath it.
  private static func drawWatermark(cg: CGContext, frameWidth W: CGFloat, frameHeight H: CGFloat) {
    let logoSide = H * 0.05
    let logoX = (W - logoSide) / 2
    let logoY = H * 0.90
    let logoRect = CGRect(x: logoX, y: logoY, width: logoSide, height: logoSide)

    if let logo = watermarkLogo {
      cg.saveGState()
      let clip = UIBezierPath(roundedRect: logoRect, cornerRadius: logoSide * 0.24)
      clip.addClip()
      logo.draw(in: logoRect)
      cg.restoreGState()
    }

    // Wordmark matching the in-app lockup: NotoSansJP ExtraBold, "Chord " in bright
    // text and "Palette" filled with the rainbow gradient.
    drawWordmark(centerX: W / 2, top: logoRect.maxY + H * 0.008, fontSize: H * 0.018)
  }

  /** App brand font (NotoSansJP ExtraBold, registered at launch by expo-font); falls
   * back to a heavy system font if the family is unavailable. */
  private static func brandFont(size: CGFloat) -> UIFont {
    for name in ["NotoSansJP-ExtraBold", "NotoSansJP_800ExtraBold", "NotoSansJP-Bold"] {
      if let f = UIFont(name: name, size: size) { return f }
    }
    return .systemFont(ofSize: size, weight: .heavy)
  }

  /** Rainbow wordmark palette (theme tokens `rainbow`). */
  private static let wordmarkRainbow: [UIColor] = [
    UIColor(red: 0xef / 255, green: 0x44 / 255, blue: 0x44 / 255, alpha: 0.92),
    UIColor(red: 0xf9 / 255, green: 0x73 / 255, blue: 0x16 / 255, alpha: 0.92),
    UIColor(red: 0xea / 255, green: 0xb3 / 255, blue: 0x08 / 255, alpha: 0.92),
    UIColor(red: 0x22 / 255, green: 0xc5 / 255, blue: 0x5e / 255, alpha: 0.92),
    UIColor(red: 0x3b / 255, green: 0x82 / 255, blue: 0xf6 / 255, alpha: 0.92),
    UIColor(red: 0x8b / 255, green: 0x5c / 255, blue: 0xf6 / 255, alpha: 0.92),
  ]

  /**
   * Draw the "Chord Palette" lockup centered on `centerX`, with its top at `top`.
   * "Chord " is bright; "Palette" is filled with a left→right rainbow gradient
   * (clipped to the glyph outlines), mirroring `Wordmark.tsx`.
   */
  private static func drawWordmark(centerX: CGFloat, top: CGFloat, fontSize: CGFloat) {
    let font = brandFont(size: fontSize)
    let kern = fontSize * 0.012
    let chord = "Chord "
    let palette = "Palette"

    let chordAttrs: [NSAttributedString.Key: Any] = [
      .font: font, .foregroundColor: textPrimary.withAlphaComponent(0.9), .kern: kern,
    ]
    let chordW = (chord as NSString).size(withAttributes: chordAttrs).width
    let paletteW = (palette as NSString).size(withAttributes: [.font: font, .kern: kern]).width
    let startX = centerX - (chordW + paletteW) / 2

    (chord as NSString).draw(at: CGPoint(x: startX, y: top), withAttributes: chordAttrs)
    drawGradientText(
      palette, font: font, kern: kern, origin: CGPoint(x: startX + chordW, y: top),
      colors: wordmarkRainbow)
  }

  /** Fill a text run with a horizontal gradient by clipping the context to its glyph
   * outlines (CoreText), then drawing the gradient across its width. */
  private static func drawGradientText(
    _ text: String, font: UIFont, kern: CGFloat, origin: CGPoint, colors: [UIColor]
  ) {
    guard let cg = UIGraphicsGetCurrentContext() else { return }
    let attr = NSAttributedString(string: text, attributes: [.font: font, .kern: kern])
    let line = CTLineCreateWithAttributedString(attr)
    var ascent: CGFloat = 0
    var descent: CGFloat = 0
    var leading: CGFloat = 0
    let width = CGFloat(CTLineGetTypographicBounds(line, &ascent, &descent, &leading))

    cg.saveGState()
    // Baseline sits at (top + ascent); flip the y-axis so CoreText draws upright in
    // the UIKit (top-left) image context.
    cg.translateBy(x: origin.x, y: origin.y + ascent)
    cg.scaleBy(x: 1, y: -1)
    cg.textPosition = .zero
    cg.setTextDrawingMode(.clip)
    CTLineDraw(line, cg)

    let space = CGColorSpaceCreateDeviceRGB()
    if let grad = CGGradient(
      colorsSpace: space, colors: colors.map { $0.cgColor } as CFArray, locations: nil)
    {
      cg.drawLinearGradient(
        grad, start: CGPoint(x: 0, y: 0), end: CGPoint(x: max(1, width), y: 0), options: [])
    }
    cg.restoreGState()
  }

  private static func drawKeyboard(
    plan: RenderPlan, seg: RenderSegment?, accent: UIColor, rect: CGRect, frameHeight: CGFloat,
    highlightT: CGFloat, pulse: CGFloat
  ) {
    let ctx = UIGraphicsGetCurrentContext()
    let keys = KeyboardLayout.layout(
      low: plan.keyboardLow, high: plan.keyboardHigh, totalWidth: rect.width)
    let active: Set<Int> =
      seg.map { KeyboardLayout.highlighted($0.midiNotes, low: plan.keyboardLow, high: plan.keyboardHigh) }
      ?? []

    let blackH = rect.height * 0.62
    let labelFont = UIFont.systemFont(ofSize: frameHeight * 0.014, weight: .bold)

    // White keys — base first, then an accent overlay that fades in + blooms.
    for k in keys where !k.isBlack {
      let on = active.contains(k.midi)
      let r = CGRect(x: rect.minX + k.left, y: rect.minY, width: k.width, height: rect.height)
      whiteKey.setFill()
      UIBezierPath(rect: r).fill()
      if on {
        ctx?.saveGState()
        ctx?.setShadow(
          offset: .zero, blur: rect.height * 0.22 * (0.5 + pulse),
          color: accent.withAlphaComponent(0.9).cgColor)
        accent.withAlphaComponent(highlightT).setFill()
        UIBezierPath(rect: r).fill()
        ctx?.restoreGState()
      }
      blackKey.setStroke()
      let border = UIBezierPath(rect: r)
      border.lineWidth = 1
      border.stroke()
    }
    // Black keys (on top).
    for k in keys where k.isBlack {
      let on = active.contains(k.midi)
      let r = CGRect(x: rect.minX + k.left, y: rect.minY, width: k.width, height: blackH)
      blackKey.setFill()
      UIBezierPath(roundedRect: r, cornerRadius: 2).fill()
      if on {
        ctx?.saveGState()
        ctx?.setShadow(
          offset: .zero, blur: blackH * 0.20 * (0.5 + pulse),
          color: accent.withAlphaComponent(0.95).cgColor)
        accent.withAlphaComponent(highlightT).setFill()
        UIBezierPath(roundedRect: r, cornerRadius: 2).fill()
        ctx?.restoreGState()
      }
    }

    // Note-name labels above pressed keys.
    if !plan.pitchClassNames.isEmpty {
      for k in keys where active.contains(k.midi) {
        let name = plan.pitchClassNames[KeyboardLayout.pitchClass(k.midi)]
        let cx = rect.minX + k.left + k.width / 2
        drawCentered(
          name, font: labelFont, color: accent.withAlphaComponent(highlightT),
          centerX: cx, y: rect.minY - frameHeight * 0.026, maxWidth: k.width * 3)
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

  /// One pass of the progression, used for the dot strip. Prefers the explicit
  /// chord count (one dot per chord, exact for any length up to the 16-bar max);
  /// falls back to a time-window slice for older plans without the field.
  private static func progressionCycle(plan: RenderPlan) -> [RenderSegment] {
    if plan.chordsPerCycle > 0 {
      return Array(plan.segments.prefix(plan.chordsPerCycle))
    }
    let loopSec = Double(plan.bars) * 4.0 * (60.0 / Double(max(1, plan.bpm)))
    let cycle = plan.segments.filter { $0.startSec < loopSec - 1e-9 }
    return cycle.isEmpty ? Array(plan.segments.prefix(8)) : cycle
  }

  private static func drawProgressionDots(
    plan: RenderPlan, timeSec: Double, centerY: CGFloat, frameWidth W: CGFloat, frameHeight H: CGFloat,
    ease: CGFloat, pulse: CGFloat
  ) {
    let cycle = progressionCycle(plan: plan)
    guard !cycle.isEmpty else { return }
    let activeIdx: Int = {
      if let i = cycle.firstIndex(where: {
        timeSec >= $0.startSec && timeSec < $0.startSec + $0.durationSec
      }) { return i }
      // When time is past the first loop, map by modular position in the tile list.
      if let global = plan.segments.firstIndex(where: {
        timeSec >= $0.startSec && timeSec < $0.startSec + $0.durationSec
      }) {
        return global % cycle.count
      }
      return 0
    }()

    let dots = cycle
    let count = dots.count
    guard count > 0 else { return }
    let activeDot = activeIdx % count

    // One circular dot per chord, sized to always fit the width — so a 4-chord and
    // a 16-bar (many-chord) progression both stay consistent with the audio. The
    // active chord's dot keeps its round shape and simply lights up (full color +
    // a soft beat-synced bloom), never stretching into a pill.
    let availW = W * 0.9
    let maxDotW = H * 0.009
    let minDotW = H * 0.0035
    let denom = CGFloat(max(1, 2 * count - 1))  // gap == dotW → total = (2n − 1)·dotW
    let dotW = min(maxDotW, max(minDotW, availW / denom))
    let gap = dotW
    let totalW = CGFloat(count) * dotW + CGFloat(max(0, count - 1)) * gap
    var x = (W - totalW) / 2
    let ctx = UIGraphicsGetCurrentContext()

    for (i, seg) in dots.enumerated() {
      let r = CGRect(x: x, y: centerY - dotW / 2, width: dotW, height: dotW)
      let dot = UIBezierPath(ovalIn: r)
      if i == activeDot {
        ctx?.saveGState()
        ctx?.setShadow(
          offset: .zero, blur: dotW * (1.4 + 2.2 * pulse) * (0.6 + 0.4 * ease),
          color: seg.color.withAlphaComponent(0.95).cgColor)
        seg.color.setFill()
        dot.fill()
        ctx?.restoreGState()
      } else {
        seg.color.withAlphaComponent(0.22).setFill()
        dot.fill()
      }
      x += dotW + gap
    }
  }

  /// Soft radial bloom used behind the chord name (accent → transparent).
  private static func drawRadialGlow(
    _ cg: CGContext, center: CGPoint, radius: CGFloat, color: UIColor, alpha: CGFloat
  ) {
    guard alpha > 0.001, radius > 0 else { return }
    let space = CGColorSpaceCreateDeviceRGB()
    let cs =
      [color.withAlphaComponent(alpha).cgColor, color.withAlphaComponent(0).cgColor] as CFArray
    guard let grad = CGGradient(colorsSpace: space, colors: cs, locations: [0, 1]) else { return }
    cg.saveGState()
    cg.drawRadialGradient(
      grad, startCenter: center, startRadius: 0, endCenter: center, endRadius: radius, options: [])
    cg.restoreGState()
  }

  /// Centered text with a beat-pulse scale, accent glow, and fade-in alpha.
  private static func drawCenteredScaled(
    _ text: String, font: UIFont, color: UIColor, centerX: CGFloat, y: CGFloat, maxWidth: CGFloat,
    scale: CGFloat, glowColor: UIColor, glowRadius: CGFloat, alpha: CGFloat
  ) {
    guard alpha > 0.001 else { return }
    let para = NSMutableParagraphStyle()
    para.alignment = .center
    para.lineBreakMode = .byTruncatingTail
    let attrs: [NSAttributedString.Key: Any] = [
      .font: font, .foregroundColor: color.withAlphaComponent(alpha), .paragraphStyle: para,
    ]
    let rect = CGRect(x: centerX - maxWidth / 2, y: y, width: maxWidth, height: font.lineHeight * 1.4)
    guard let ctx = UIGraphicsGetCurrentContext() else {
      (text as NSString).draw(in: rect, withAttributes: attrs)
      return
    }
    ctx.saveGState()
    ctx.translateBy(x: rect.midX, y: rect.midY)
    ctx.scaleBy(x: scale, y: scale)
    ctx.translateBy(x: -rect.midX, y: -rect.midY)
    if glowRadius > 0.1 {
      ctx.setShadow(
        offset: .zero, blur: glowRadius, color: glowColor.withAlphaComponent(0.8 * alpha).cgColor)
    }
    (text as NSString).draw(in: rect, withAttributes: attrs)
    ctx.restoreGState()
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

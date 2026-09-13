import CoreText
import UIKit

/// "Chord Palette" wordmark for Flow, matched to the in-app lockup: "Chord " in bright
/// text and "Palette" filled with the brand rainbow (theme tokens `rainbow`).
///
/// Classic draws the same lockup inside its frozen renderer, so the word split, brand
/// font and palette are restated here instead of extracted. The Flow architecture gate
/// compares both definitions so the two can never drift apart.
enum FlowBrandWordmarkRenderer {
  private static let chordWord = "Chord "
  private static let paletteWord = "Palette"
  private static let brightText = UIColor(
    red: 0xee / 255, green: 0xf1 / 255, blue: 0xf6 / 255, alpha: 1)

  /** Rainbow wordmark palette (theme tokens `rainbow`). */
  private static let wordmarkRainbow: [UIColor] = [
    UIColor(red: 0xef / 255, green: 0x44 / 255, blue: 0x44 / 255, alpha: 0.92),
    UIColor(red: 0xf9 / 255, green: 0x73 / 255, blue: 0x16 / 255, alpha: 0.92),
    UIColor(red: 0xea / 255, green: 0xb3 / 255, blue: 0x08 / 255, alpha: 0.92),
    UIColor(red: 0x22 / 255, green: 0xc5 / 255, blue: 0x5e / 255, alpha: 0.92),
    UIColor(red: 0x3b / 255, green: 0x82 / 255, blue: 0xf6 / 255, alpha: 0.92),
    UIColor(red: 0x8b / 255, green: 0x5c / 255, blue: 0xf6 / 255, alpha: 0.92),
  ]

  /** App brand font (NotoSansJP ExtraBold, registered at launch by expo-font). */
  static func brandFont(size: CGFloat) -> UIFont {
    for name in ["NotoSansJP-ExtraBold", "NotoSansJP_800ExtraBold", "NotoSansJP-Bold"] {
      if let font = UIFont(name: name, size: size) { return font }
    }
    return .systemFont(ofSize: size, weight: .heavy)
  }

  /// Rendered size of the whole lockup, so the caller can center it with the icon.
  static func size(fontSize: CGFloat) -> CGSize {
    let font = brandFont(size: fontSize)
    let attributes: [NSAttributedString.Key: Any] = [.font: font, .kern: kern(fontSize)]
    let chord = (chordWord as NSString).size(withAttributes: attributes)
    let palette = (paletteWord as NSString).size(withAttributes: attributes)
    return CGSize(width: chord.width + palette.width, height: max(chord.height, palette.height))
  }

  /// Draws the lockup with its left edge at `left` and its text top at `top`.
  static func draw(left: CGFloat, top: CGFloat, fontSize: CGFloat, alpha: CGFloat) {
    let font = brandFont(size: fontSize)
    let letterSpacing = kern(fontSize)
    let chordAttributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: brightText.withAlphaComponent(alpha),
      .kern: letterSpacing,
    ]
    let chordWidth = (chordWord as NSString).size(withAttributes: chordAttributes).width

    (chordWord as NSString).draw(at: CGPoint(x: left, y: top), withAttributes: chordAttributes)
    drawGradientText(
      paletteWord,
      font: font,
      kern: letterSpacing,
      origin: CGPoint(x: left + chordWidth, y: top),
      colors: wordmarkRainbow.map { $0.withAlphaComponent($0.cgColor.alpha * alpha) }
    )
  }

  private static func kern(_ fontSize: CGFloat) -> CGFloat {
    fontSize * 0.012
  }

  /** Fill a text run with a horizontal gradient by clipping the context to its glyph
   * outlines (CoreText), then drawing the gradient across its width. */
  private static func drawGradientText(
    _ text: String,
    font: UIFont,
    kern: CGFloat,
    origin: CGPoint,
    colors: [UIColor]
  ) {
    guard let cg = UIGraphicsGetCurrentContext() else { return }
    let attributed = NSAttributedString(string: text, attributes: [.font: font, .kern: kern])
    let line = CTLineCreateWithAttributedString(attributed)
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

    if let gradient = CGGradient(
      colorsSpace: CGColorSpaceCreateDeviceRGB(),
      colors: colors.map { $0.cgColor } as CFArray,
      locations: nil
    ) {
      cg.drawLinearGradient(
        gradient,
        start: CGPoint(x: 0, y: 0),
        end: CGPoint(x: max(1, width), y: 0),
        options: []
      )
    }
    cg.restoreGState()
  }
}

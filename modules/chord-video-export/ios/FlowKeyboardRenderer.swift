import UIKit

/// Compact, lower-priority keyboard strip for Flow.
///
/// KeyboardLayout remains the single source of note geometry and highlighting.
enum FlowKeyboardRenderer {
  private static let paletteGreen = UIColor(
    red: 0x2c / 255, green: 0xe6 / 255, blue: 0x9f / 255, alpha: 1)
  private static let whiteKey = UIColor(
    red: 0xd7 / 255, green: 0xdf / 255, blue: 0xe9 / 255, alpha: 0.74)
  private static let blackKey = UIColor(
    red: 0x0b / 255, green: 0x11 / 255, blue: 0x1d / 255, alpha: 0.96)

  static func draw(
    plan: RenderPlan,
    currentSegment: RenderSegment,
    rect: CGRect,
    frameHeight height: CGFloat
  ) {
    let keys = KeyboardLayout.layout(
      low: plan.keyboardLow,
      high: plan.keyboardHigh,
      totalWidth: rect.width
    )
    let active = KeyboardLayout.highlighted(
      currentSegment.midiNotes,
      low: plan.keyboardLow,
      high: plan.keyboardHigh
    )
    let blackHeight = rect.height * 0.61

    for key in keys where !key.isBlack {
      let keyRect = CGRect(
        x: rect.minX + key.left,
        y: rect.minY,
        width: key.width,
        height: rect.height
      )
      if active.contains(key.midi) {
        paletteGreen.withAlphaComponent(0.20).setFill()
        UIBezierPath(
          roundedRect: keyRect.insetBy(dx: -height * 0.004, dy: -height * 0.005),
          cornerRadius: height * 0.005
        ).fill()
      }
      (active.contains(key.midi)
        ? paletteGreen.withAlphaComponent(0.90)
        : whiteKey
      ).setFill()
      UIBezierPath(rect: keyRect).fill()
      blackKey.withAlphaComponent(0.74).setStroke()
      let border = UIBezierPath(rect: keyRect)
      border.lineWidth = 1
      border.stroke()
    }

    for key in keys where key.isBlack {
      let keyRect = CGRect(
        x: rect.minX + key.left,
        y: rect.minY,
        width: key.width,
        height: blackHeight
      )
      (active.contains(key.midi)
        ? paletteGreen.withAlphaComponent(0.88)
        : blackKey
      ).setFill()
      UIBezierPath(roundedRect: keyRect, cornerRadius: 2).fill()
    }

    guard !plan.pitchClassNames.isEmpty else { return }
    for key in keys where active.contains(key.midi) {
      let name = plan.pitchClassNames[KeyboardLayout.pitchClass(key.midi)]
      drawNoteName(
        name,
        centerX: rect.minX + key.left + key.width / 2,
        y: rect.minY - height * 0.020,
        maxWidth: key.width * 2.6,
        frameHeight: height
      )
    }
  }

  private static func drawNoteName(
    _ text: String,
    centerX: CGFloat,
    y: CGFloat,
    maxWidth: CGFloat,
    frameHeight height: CGFloat
  ) {
    let font = UIFont.systemFont(ofSize: height * 0.011, weight: .bold)
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineBreakMode = .byClipping
    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: paletteGreen.withAlphaComponent(0.86),
      .paragraphStyle: paragraph,
    ]
    let rect = CGRect(
      x: centerX - maxWidth / 2,
      y: y,
      width: maxWidth,
      height: font.lineHeight * 1.25
    )
    (text as NSString).draw(in: rect, withAttributes: attributes)
  }
}

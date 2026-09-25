import UIKit

/// Compact, lower-priority keyboard strip for Flow.
///
/// KeyboardLayout remains the single source of note geometry. Highlighting is driven
/// only by note-level landing times, never by chord segments.
enum FlowKeyboardRenderer {
  private static let whiteKey = UIColor(
    red: 0xd7 / 255, green: 0xdf / 255, blue: 0xe9 / 255, alpha: 0.74)
  private static let blackKey = UIColor(
    red: 0x0b / 255, green: 0x11 / 255, blue: 0x1d / 255, alpha: 0.96)

  private struct LandingVisual {
    let intensity: CGFloat
  }

  static func draw(
    plan: RenderPlan,
    events: [FlowVisualNoteEvent],
    keys: [KeyRect],
    fallbackColor: UIColor,
    frameTimeSec: Double,
    rect: CGRect,
    frameHeight height: CGFloat,
    aura: FlowNonDiatonicAuraIntensity = FlowNonDiatonicAuraIntensity(current: 0, incoming: 0),
    cg: CGContext? = nil
  ) {
    var landingByMidi: [Int: LandingVisual] = [:]
    for event in events {
      let folded = KeyboardLayout.fold(event.pitch, low: plan.keyboardLow, high: plan.keyboardHigh)
      let intensity = FlowFallingBlockStateResolver.landingIntensity(
        event: event,
        frameTimeSec: frameTimeSec
      )
      if intensity > (landingByMidi[folded]?.intensity ?? 0) {
        landingByMidi[folded] = LandingVisual(intensity: intensity)
      }
    }
    let blackHeight = rect.height * 0.61
    // Collected while drawing so the violet afterglow can go over the function colour
    // instead of replacing it: the key stays readable as T / SD / D underneath.
    var litRects: [CGRect] = []

    for key in keys where !key.isBlack {
      let keyRect = CGRect(
        x: rect.minX + key.left,
        y: rect.minY,
        width: key.width,
        height: rect.height
      )
      let landing = landingByMidi[key.midi]
      let intensity = landing?.intensity ?? 0
      if intensity > 0 {
        fallbackColor.withAlphaComponent(0.10 + intensity * 0.20).setFill()
        UIBezierPath(
          roundedRect: keyRect.insetBy(dx: -height * 0.004, dy: -height * 0.005),
          cornerRadius: height * 0.005
        ).fill()
      }
      (intensity > 0
        ? fallbackColor.withAlphaComponent(0.34 + intensity * 0.62)
        : whiteKey
      ).setFill()
      UIBezierPath(rect: keyRect).fill()
      if intensity > 0 { litRects.append(keyRect) }
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
      let landing = landingByMidi[key.midi]
      let intensity = landing?.intensity ?? 0
      (intensity > 0
        ? fallbackColor.withAlphaComponent(0.36 + intensity * 0.58)
        : blackKey
      ).setFill()
      UIBezierPath(roundedRect: keyRect, cornerRadius: 2).fill()
      if intensity > 0 { litRects.append(keyRect) }
    }

    if let cg {
      FlowNonDiatonicAuraRenderer.drawKeyAfterglow(
        intensity: aura,
        rects: litRects,
        cg: cg,
        frameHeight: height
      )
    }

    guard !plan.pitchClassNames.isEmpty else { return }
    for key in keys where (landingByMidi[key.midi]?.intensity ?? 0) > 0 {
      let name = plan.pitchClassNames[KeyboardLayout.pitchClass(key.midi)]
      drawNoteName(
        name,
        color: fallbackColor,
        centerX: rect.minX + key.left + key.width / 2,
        y: rect.minY - height * 0.020,
        maxWidth: key.width * 2.6,
        frameHeight: height
      )
    }
  }

  private static func drawNoteName(
    _ text: String,
    color: UIColor,
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
      .foregroundColor: color.withAlphaComponent(0.86),
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

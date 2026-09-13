import CoreGraphics
import UIKit

final class CompareFrameRenderer: VideoFrameRendering {
  private let scene: CompareScene

  init(scene: CompareScene) {
    self.scene = scene
  }

  func makeImage(plan: RenderPlan, timeSec: Double) -> CGImage? {
    guard let state = CompareFrameState.evaluate(scene: scene, timeSec: timeSec) else {
      return nil
    }
    let size = CGSize(width: plan.width, height: plan.height)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    return UIGraphicsImageRenderer(size: size, format: format).image { context in
      draw(state: state, context: context.cgContext, size: size)
    }.cgImage
  }

  private func draw(state: CompareFrameState, context: CGContext, size: CGSize) {
    let width = size.width
    let height = size.height
    let top = UIColor(red: 0x10 / 255, green: 0x1d / 255, blue: 0x2d / 255, alpha: 1)
    let middle = UIColor(red: 0x0b / 255, green: 0x12 / 255, blue: 0x21 / 255, alpha: 1)
    let bottom = UIColor(red: 0x07 / 255, green: 0x0a / 255, blue: 0x12 / 255, alpha: 1)
    if let gradient = CGGradient(
      colorsSpace: CGColorSpaceCreateDeviceRGB(),
      colors: [top.cgColor, middle.cgColor, bottom.cgColor] as CFArray,
      locations: [0, 0.55, 1]
    ) {
      context.drawLinearGradient(
        gradient,
        start: .zero,
        end: CGPoint(x: 0, y: height),
        options: []
      )
    }

    let accent = UIColor(red: 0x4b / 255, green: 0xe3 / 255, blue: 0xb5 / 255, alpha: 1)
    let cyan = UIColor(red: 0x62 / 255, green: 0xc8 / 255, blue: 0xff / 255, alpha: 1)
    let primary = UIColor(red: 0xee / 255, green: 0xf1 / 255, blue: 0xf6 / 255, alpha: 1)
    let muted = UIColor(red: 0x9a / 255, green: 0xa3 / 255, blue: 0xb5 / 255, alpha: 1)
    let faint = UIColor(red: 0x6b / 255, green: 0x76 / 255, blue: 0x88 / 255, alpha: 1)

    if state.cue.changed && state.cue.role == "variant" {
      let alpha = CGFloat(0.08 + 0.12 * state.revealProgress)
      accent.withAlphaComponent(alpha).setFill()
      context.fillEllipse(
        in: CGRect(
          x: width * 0.15,
          y: height * 0.18,
          width: width * 0.7,
          height: height * 0.43
        )
      )
    }

    drawCentered(
      scene.title,
      y: height * 0.075,
      width: width,
      font: .systemFont(ofSize: height * 0.025, weight: .semibold),
      color: muted
    )
    let roleLabel = state.cue.role == "base" ? scene.baseLabel : scene.variantLabel
    drawPill(
      roleLabel,
      y: height * 0.145,
      width: width,
      color: state.cue.role == "base" ? cyan : accent
    )
    drawCentered(
      scene.hook,
      y: height * 0.215,
      width: width,
      font: .systemFont(ofSize: height * 0.043, weight: .bold),
      color: primary
    )
    drawCentered(
      state.cue.currentChord,
      y: height * 0.325,
      width: width,
      font: .systemFont(ofSize: height * 0.112, weight: .black),
      color: state.cue.changed && state.cue.role == "variant" ? accent : primary
    )

    if let next = state.cue.nextChord {
      drawCentered(
        "NEXT  \(next)",
        y: height * 0.47,
        width: width,
        font: .systemFont(ofSize: height * 0.026, weight: .semibold),
        color: faint
      )
    }
    if let change = state.cue.changeLabel, state.cue.role == "variant" {
      drawCentered(
        change,
        y: height * 0.525,
        width: width,
        font: .systemFont(ofSize: height * 0.035, weight: .bold),
        color: accent.withAlphaComponent(CGFloat(0.55 + 0.45 * state.revealProgress))
      )
    }

    drawCards(
      state.page.cards,
      currentEventId: state.cue.eventId,
      anticipatedEventId: state.anticipatedCue?.eventId,
      y: height * 0.62,
      width: width,
      height: height,
      accent: accent,
      cyan: cyan,
      primary: primary,
      muted: muted
    )

    if state.cue.role == "variant" && state.storyProgress > 0.86 {
      drawCentered(
        scene.closing,
        y: height * 0.725,
        width: width,
        font: .systemFont(ofSize: height * 0.027, weight: .semibold),
        color: muted
      )
    }
    CompareBrandRenderer.draw(scene: scene, width: width, height: height)
  }

  private func drawPill(_ text: String, y: CGFloat, width: CGFloat, color: UIColor) {
    let font = UIFont.systemFont(ofSize: width * 0.032, weight: .bold)
    let textSize = (text as NSString).size(withAttributes: [.font: font])
    let rect = CGRect(
      x: (width - textSize.width - width * 0.07) / 2,
      y: y,
      width: textSize.width + width * 0.07,
      height: textSize.height + width * 0.025
    )
    color.withAlphaComponent(0.13).setFill()
    UIBezierPath(roundedRect: rect, cornerRadius: rect.height / 2).fill()
    (text as NSString).draw(
      at: CGPoint(x: rect.minX + width * 0.035, y: rect.minY + width * 0.012),
      withAttributes: [.font: font, .foregroundColor: color]
    )
  }

  private func drawCards(
    _ cards: [CompareSceneCard],
    currentEventId: String,
    anticipatedEventId: String?,
    y: CGFloat,
    width: CGFloat,
    height: CGFloat,
    accent: UIColor,
    cyan: UIColor,
    primary: UIColor,
    muted: UIColor
  ) {
    let gap = width * 0.018
    let outer = width * 0.09
    let cardWidth = (width - outer * 2 - gap * CGFloat(max(0, cards.count - 1)))
      / CGFloat(max(1, cards.count))
    let cardHeight = height * 0.09
    for (index, card) in cards.enumerated() {
      let rect = CGRect(
        x: outer + CGFloat(index) * (cardWidth + gap),
        y: y,
        width: cardWidth,
        height: cardHeight
      )
      let current = card.eventId == currentEventId
      let anticipated = card.eventId == anticipatedEventId
      UIColor(white: 1, alpha: current ? 0.11 : 0.045).setFill()
      UIBezierPath(roundedRect: rect, cornerRadius: height * 0.012).fill()
      (current ? (card.changed ? accent : cyan) : muted.withAlphaComponent(0.38)).setStroke()
      let path = UIBezierPath(roundedRect: rect, cornerRadius: height * 0.012)
      path.lineWidth = anticipated ? 5 : (current ? 4 : 2)
      path.stroke()
      drawCentered(
        card.displayName,
        y: rect.minY + cardHeight * 0.2,
        width: cardWidth,
        x: rect.minX,
        font: .systemFont(ofSize: height * 0.027, weight: .bold),
        color: current ? primary : muted
      )
      drawCentered(
        card.degreeLabel,
        y: rect.minY + cardHeight * 0.59,
        width: cardWidth,
        x: rect.minX,
        font: .systemFont(ofSize: height * 0.014, weight: .medium),
        color: muted
      )
    }
  }

  private func drawCentered(
    _ text: String,
    y: CGFloat,
    width: CGFloat,
    x: CGFloat = 0,
    font: UIFont,
    color: UIColor
  ) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    (text as NSString).draw(
      in: CGRect(x: x, y: y, width: width, height: font.lineHeight * 2.2),
      withAttributes: [
        .font: font,
        .foregroundColor: color,
        .paragraphStyle: paragraph,
      ]
    )
  }
}

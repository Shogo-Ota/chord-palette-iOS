import UIKit

/// Flow-only official brand lockup.
///
/// Places the approved icon and the "Chord Palette" wordmark side by side; the wordmark
/// itself is owned by FlowBrandWordmarkRenderer so this file only resolves layout.
enum FlowBrandRenderer {
  private static let wordmarkAlpha: CGFloat = 0.92
  private static let officialIcon: UIImage? = {
    guard let path = Bundle.main.path(forResource: "cp-watermark", ofType: "png") else {
      return nil
    }
    return UIImage(contentsOfFile: path)
  }()

  static func draw(frameWidth width: CGFloat, frameHeight height: CGFloat) {
    guard let context = UIGraphicsGetCurrentContext() else { return }

    let side = height * 0.046
    let gap = width * 0.016
    let fontSize = height * 0.024
    let textSize = FlowBrandWordmarkRenderer.size(fontSize: fontSize)
    let iconWidth = officialIcon == nil ? 0 : side + gap
    let totalWidth = iconWidth + textSize.width
    let startX = (width - totalWidth) / 2
    let top = height * 0.895

    if let icon = officialIcon {
      let rect = CGRect(x: startX, y: top, width: side, height: side)
      context.saveGState()
      UIBezierPath(roundedRect: rect, cornerRadius: side * 0.24).addClip()
      icon.draw(in: rect, blendMode: .normal, alpha: 0.88)
      context.restoreGState()
    }

    FlowBrandWordmarkRenderer.draw(
      left: startX + iconWidth,
      top: top + (side - textSize.height) / 2,
      fontSize: fontSize,
      alpha: Self.wordmarkAlpha
    )
  }
}

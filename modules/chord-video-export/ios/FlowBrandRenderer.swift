import UIKit

/// Flow-only official brand lockup.
///
/// Uses the approved icon plus the product name as a compact horizontal lockup.
enum FlowBrandRenderer {
  private static let productName = "Chord Palette"
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
    let font = UIFont.systemFont(ofSize: height * 0.024, weight: .bold)
    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: UIColor(white: 0.92, alpha: 0.84),
    ]
    let textSize = (productName as NSString).size(withAttributes: attributes)
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

    (productName as NSString).draw(
      at: CGPoint(
        x: startX + iconWidth,
        y: top + (side - textSize.height) / 2
      ),
      withAttributes: attributes
    )
  }
}

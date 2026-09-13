import UIKit

enum CompareBrandRenderer {
  private static let officialIcon: UIImage? = {
    guard let path = Bundle.main.path(forResource: "cp-watermark", ofType: "png") else {
      return nil
    }
    return UIImage(contentsOfFile: path)
  }()

  static func draw(scene: CompareScene, width: CGFloat, height: CGFloat) {
    let iconSide = height * 0.04
    let font = UIFont.systemFont(ofSize: height * 0.024, weight: .bold)
    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: UIColor(white: 0.92, alpha: 0.82),
    ]
    let textSize = (scene.productName as NSString).size(withAttributes: attributes)
    let gap = width * 0.018
    let totalWidth = iconSide + gap + textSize.width
    let x = (width - totalWidth) / 2
    let y = height * 0.78

    if let icon = officialIcon, let context = UIGraphicsGetCurrentContext() {
      let rect = CGRect(x: x, y: y, width: iconSide, height: iconSide)
      context.saveGState()
      UIBezierPath(roundedRect: rect, cornerRadius: iconSide * 0.24).addClip()
      icon.draw(in: rect, blendMode: .normal, alpha: 0.9)
      context.restoreGState()
    }
    (scene.productName as NSString).draw(
      at: CGPoint(x: x + iconSide + gap, y: y + (iconSide - textSize.height) / 2),
      withAttributes: attributes
    )
  }
}

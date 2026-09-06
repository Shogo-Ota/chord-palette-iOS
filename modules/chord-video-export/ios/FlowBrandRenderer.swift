import UIKit

/// Flow-only official brand lockup.
///
/// No repository-owned wordmark image exists, so Phase V4 renders only the
/// approved cp-watermark asset rather than reconstructing a pseudo wordmark.
enum FlowBrandRenderer {
  private static let officialIcon: UIImage? = {
    guard let path = Bundle.main.path(forResource: "cp-watermark", ofType: "png") else {
      return nil
    }
    return UIImage(contentsOfFile: path)
  }()

  static func draw(frameWidth width: CGFloat, frameHeight height: CGFloat) {
    guard let icon = officialIcon, let context = UIGraphicsGetCurrentContext() else {
      return
    }

    let side = height * 0.052
    let rect = CGRect(
      x: (width - side) / 2,
      y: height * 0.895,
      width: side,
      height: side
    )

    context.saveGState()
    UIBezierPath(roundedRect: rect, cornerRadius: side * 0.24).addClip()
    icon.draw(in: rect, blendMode: .normal, alpha: 0.88)
    context.restoreGState()
  }
}

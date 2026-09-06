import UIKit

/// Draws visible harmonic performance notes as compact rounded blocks.
enum FlowFallingBlockRenderer {
  private static let coolCyan = UIColor(
    red: 0x51 / 255, green: 0xd9 / 255, blue: 0xe8 / 255, alpha: 1)
  private static let paletteGreen = UIColor(
    red: 0x2c / 255, green: 0xe6 / 255, blue: 0x9f / 255, alpha: 1)

  static func draw(
    events: [FlowVisualNoteEvent],
    plan: RenderPlan,
    keys: [KeyRect],
    frameTimeSec: Double,
    fallTopY: CGFloat,
    keyboardRect: CGRect,
    frameHeight: CGFloat
  ) {
    let keysByMidi = Dictionary(uniqueKeysWithValues: keys.map { ($0.midi, $0) })

    for event in events {
      let foldedPitch = KeyboardLayout.fold(
        event.pitch,
        low: plan.keyboardLow,
        high: plan.keyboardHigh
      )
      guard
        let key = keysByMidi[foldedPitch],
        let state = FlowFallingBlockStateResolver.resolve(
          event: event,
          key: key,
          frameTimeSec: frameTimeSec,
          laneOriginX: keyboardRect.minX,
          fallTopY: fallTopY,
          keyboardTopY: keyboardRect.minY,
          frameHeight: frameHeight
        )
      else { continue }

      let cornerRadius = min(frameHeight * 0.005, state.rect.width * 0.20)
      coolCyan.withAlphaComponent(state.opacity).setFill()
      UIBezierPath(roundedRect: state.rect, cornerRadius: cornerRadius).fill()

      // One thin leading edge makes the exact landing point legible without a trail.
      let edgeHeight = min(frameHeight * 0.003, state.rect.height)
      let edgeRect = CGRect(
        x: state.rect.minX,
        y: state.rect.maxY - edgeHeight,
        width: state.rect.width,
        height: edgeHeight
      )
      paletteGreen.withAlphaComponent(min(1, state.opacity + 0.02)).setFill()
      UIBezierPath(
        roundedRect: edgeRect,
        cornerRadius: min(cornerRadius, edgeHeight / 2)
      ).fill()
    }
  }
}

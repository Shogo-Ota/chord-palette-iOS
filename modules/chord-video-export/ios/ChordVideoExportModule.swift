import ExpoModulesCore
import UIKit

/// JS-facing chord occurrence on the export timeline.
struct ExportSegmentRecord: Record {
  @Field var displayName: String = ""
  @Field var degreeLabel: String = ""
  @Field var colorHex: String = "#ffffff"
  /// Small key-context indicator color; empty when the progression is single-key.
  @Field var keyTintHex: String = ""
  /// Key name spelled next to the degree (e.g. "G"); empty when single-key.
  @Field var keyName: String = ""
  @Field var midiNotes: [Int] = []
  @Field var startSec: Double = 0
  @Field var durationSec: Double = 0
}

/// JS-facing render plan (mirrors ExportPlan in TS).
struct ExportPlanRecord: Record {
  @Field var width: Int = 1080
  @Field var height: Int = 1920
  @Field var fps: Int = 30
  @Field var durationSec: Double = 15
  @Field var audioUri: String = ""
  @Field var title: String = ""
  @Field var keyLabel: String = ""
  @Field var bpm: Int = 120
  @Field var bars: Int = 1
  @Field var chordsPerCycle: Int = 0
  @Field var watermark: Bool = false
  @Field var keyboardLow: Int = 36
  @Field var keyboardHigh: Int = 60
  @Field var pitchClassNames: [String] = []
  @Field var segments: [ExportSegmentRecord] = []
}

/// Expo Custom Native Module bridging JS ↔ `VideoWriter` (Phase 4). Holds no music
/// logic; it maps the plan and forwards to the encoder (sprint-4.md §0).
public class ChordVideoExportModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ChordVideoExport")

    Events("onProgress")

    Function("isAvailable") { () -> Bool in true }

    Function("getVersion") { () -> String in "4A.0.0" }

    AsyncFunction("exportVideo") { (planRecord: ExportPlanRecord, promise: Promise) in
      guard let audioURL = URL(string: planRecord.audioUri) else {
        promise.reject("ERR_AUDIO_URI", "Invalid audio URI")
        return
      }

      let segments = planRecord.segments.map { s in
        RenderSegment(
          displayName: s.displayName,
          degreeLabel: s.degreeLabel,
          color: Self.color(fromHex: s.colorHex),
          keyTint: s.keyTintHex.isEmpty ? nil : Self.color(fromHex: s.keyTintHex),
          keyName: s.keyName.isEmpty ? nil : s.keyName,
          midiNotes: s.midiNotes,
          startSec: s.startSec,
          durationSec: s.durationSec
        )
      }
      let plan = RenderPlan(
        width: planRecord.width,
        height: planRecord.height,
        title: planRecord.title,
        keyLabel: planRecord.keyLabel,
        bpm: planRecord.bpm,
        bars: planRecord.bars,
        chordsPerCycle: planRecord.chordsPerCycle,
        watermark: planRecord.watermark,
        keyboardLow: planRecord.keyboardLow,
        keyboardHigh: planRecord.keyboardHigh,
        pitchClassNames: planRecord.pitchClassNames,
        segments: segments
      )

      VideoWriter.write(
        plan: plan,
        fps: planRecord.fps,
        durationSec: planRecord.durationSec,
        audioURL: audioURL,
        onProgress: { [weak self] p in
          self?.sendEvent("onProgress", ["progress": p])
        },
        completion: { result in
          switch result {
          case .success(let url):
            promise.resolve(["uri": url.absoluteString])
          case .failure(let error):
            promise.reject("ERR_VIDEO_EXPORT", error.localizedDescription)
          }
        }
      )
    }
  }

  /// Parse "#rrggbb" (or "#rgb") into a UIColor; falls back to white.
  private static func color(fromHex hex: String) -> UIColor {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    if s.count == 3 {
      s = s.map { "\($0)\($0)" }.joined()
    }
    guard s.count == 6, let value = UInt32(s, radix: 16) else { return .white }
    let r = CGFloat((value >> 16) & 0xff) / 255
    let g = CGFloat((value >> 8) & 0xff) / 255
    let b = CGFloat(value & 0xff) / 255
    return UIColor(red: r, green: g, blue: b, alpha: 1)
  }
}

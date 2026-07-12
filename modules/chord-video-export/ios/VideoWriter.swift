import AVFoundation
import CoreGraphics
import UIKit

enum VideoExportError: LocalizedError {
  case setup(String)
  case write(String)

  var errorDescription: String? {
    switch self {
    case .setup(let m): return "Video export setup failed: \(m)"
    case .write(let m): return "Video export write failed: \(m)"
    }
  }
}

/// Encodes the chord/keyboard visual to an MP4 and muxes it with the offline audio
/// track (read back with AVAssetReader). Video frames are drawn by `FrameRenderer`.
enum VideoWriter {
  static func write(
    plan: RenderPlan,
    fps: Int,
    durationSec: Double,
    audioURL: URL,
    onProgress: @escaping (Double) -> Void,
    completion: @escaping (Result<URL, Error>) -> Void
  ) {
    let outURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("chord-video-\(UUID().uuidString).mp4")

    do {
      let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)

      // --- Video input ---
      let videoSettings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: plan.width,
        AVVideoHeightKey: plan.height,
      ]
      let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
      videoInput.expectsMediaDataInRealTime = false
      let pbAttrs: [String: Any] = [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: plan.width,
        kCVPixelBufferHeightKey as String: plan.height,
      ]
      let adaptor = AVAssetWriterInputPixelBufferAdaptor(
        assetWriterInput: videoInput, sourcePixelBufferAttributes: pbAttrs)
      guard writer.canAdd(videoInput) else { throw VideoExportError.setup("cannot add video input") }
      writer.add(videoInput)

      // --- Audio input (read + re-encode) ---
      let asset = AVURLAsset(url: audioURL)
      var reader: AVAssetReader?
      var readerOutput: AVAssetReaderTrackOutput?
      var audioInput: AVAssetWriterInput?
      if let track = asset.tracks(withMediaType: .audio).first {
        let r = try AVAssetReader(asset: asset)
        let ro = AVAssetReaderTrackOutput(
          track: track, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
        if r.canAdd(ro) { r.add(ro) }
        reader = r
        readerOutput = ro

        let aSettings: [String: Any] = [
          AVFormatIDKey: kAudioFormatMPEG4AAC,
          AVNumberOfChannelsKey: 2,
          AVSampleRateKey: 44_100,
          AVEncoderBitRateKey: 128_000,
        ]
        let ai = AVAssetWriterInput(mediaType: .audio, outputSettings: aSettings)
        ai.expectsMediaDataInRealTime = false
        if writer.canAdd(ai) {
          writer.add(ai)
          audioInput = ai
        }
      }

      guard writer.startWriting() else {
        throw VideoExportError.setup(writer.error?.localizedDescription ?? "startWriting")
      }
      writer.startSession(atSourceTime: .zero)
      reader?.startReading()

      let totalFrames = max(1, Int((durationSec * Double(fps)).rounded()))
      let videoQueue = DispatchQueue(label: "app.chord-palette.video")
      let audioQueue = DispatchQueue(label: "app.chord-palette.audio")
      let group = DispatchGroup()

      // Video track.
      group.enter()
      var frameIndex = 0
      videoInput.requestMediaDataWhenReady(on: videoQueue) {
        while videoInput.isReadyForMoreMediaData {
          if frameIndex >= totalFrames {
            videoInput.markAsFinished()
            group.leave()
            break
          }
          autoreleasepool {
            let t = Double(frameIndex) / Double(fps)
            let time = CMTime(value: CMTimeValue(frameIndex), timescale: CMTimeScale(fps))
            if let pb = makePixelBuffer(adaptor: adaptor, attrs: pbAttrs, plan: plan),
              let img = FrameRenderer.makeImage(plan: plan, timeSec: t)
            {
              fill(pb, with: img)
              adaptor.append(pb, withPresentationTime: time)
            }
          }
          frameIndex += 1
          onProgress(min(1.0, Double(frameIndex) / Double(totalFrames)))
        }
      }

      // Audio track (if present).
      if let audioInput = audioInput, let readerOutput = readerOutput {
        group.enter()
        audioInput.requestMediaDataWhenReady(on: audioQueue) {
          while audioInput.isReadyForMoreMediaData {
            if let sample = readerOutput.copyNextSampleBuffer() {
              audioInput.append(sample)
            } else {
              audioInput.markAsFinished()
              group.leave()
              break
            }
          }
        }
      }

      group.notify(queue: videoQueue) {
        writer.finishWriting {
          if writer.status == .completed {
            completion(.success(outURL))
          } else {
            completion(
              .failure(writer.error ?? VideoExportError.write("status \(writer.status.rawValue)")))
          }
        }
      }
    } catch {
      completion(.failure(error))
    }
  }

  private static func makePixelBuffer(
    adaptor: AVAssetWriterInputPixelBufferAdaptor, attrs: [String: Any], plan: RenderPlan
  ) -> CVPixelBuffer? {
    var pb: CVPixelBuffer?
    if let pool = adaptor.pixelBufferPool {
      CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb)
    }
    if pb == nil {
      CVPixelBufferCreate(
        nil, plan.width, plan.height, kCVPixelFormatType_32BGRA, attrs as CFDictionary, &pb)
    }
    return pb
  }

  private static func fill(_ pb: CVPixelBuffer, with image: CGImage) {
    CVPixelBufferLockBaseAddress(pb, [])
    defer { CVPixelBufferUnlockBaseAddress(pb, []) }
    let w = CVPixelBufferGetWidth(pb)
    let h = CVPixelBufferGetHeight(pb)
    let space = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo =
      CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    guard
      let ctx = CGContext(
        data: CVPixelBufferGetBaseAddress(pb), width: w, height: h, bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(pb), space: space, bitmapInfo: bitmapInfo)
    else { return }
    // The UIGraphicsImageRenderer image is top-left oriented; flip so row 0 stays on top.
    ctx.translateBy(x: 0, y: CGFloat(h))
    ctx.scaleBy(x: 1, y: -1)
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
  }
}

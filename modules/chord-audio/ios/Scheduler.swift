import Foundation

/// Pure timing math for the engine. Mirrors `src/services/audio/schedule.ts`.
///
/// Timing basis (sprint-2.md §4.2):
///  - Chord and drum sources read the SAME sample clock (`mSampleTime` from the
///    shared engine), so they stay in sync by construction.
///  - Every position is derived from the ABSOLUTE frame since playback start —
///    never by accumulating per-event error.
///  - Looping folds the absolute frame into the loop window, so no cumulative
///    drift is carried across loop boundaries.
enum Scheduler {
  /// Seconds per quarter-note beat (4/4).
  static func secondsPerBeat(bpm: Double) -> Double {
    return 60.0 / bpm
  }

  /// Frames per beat at the given tempo / sample rate.
  static func framesPerBeat(bpm: Double, sampleRate: Double) -> Double {
    return secondsPerBeat(bpm: bpm) * sampleRate
  }

  /// Total frames of one loop of the progression.
  static func loopLengthFrames(totalBeats: Double, bpm: Double, sampleRate: Double) -> Double {
    return totalBeats * framesPerBeat(bpm: bpm, sampleRate: sampleRate)
  }

  /// Equal-tempered frequency for a MIDI note (A4 = 69 = 440 Hz).
  static func frequency(forMidi note: Int) -> Double {
    return 440.0 * pow(2.0, (Double(note) - 69.0) / 12.0)
  }

  /// Fold an absolute playback frame into the current loop.
  /// Returns the frame within the loop and the loop index (0-based).
  static func fold(
    absoluteFrame: Double,
    loopLengthFrames: Double,
    loop: Bool
  ) -> (frameInLoop: Double, loopIndex: Int) {
    guard loop, loopLengthFrames > 0 else {
      return (absoluteFrame, 0)
    }
    let loopIndex = Int(floor(absoluteFrame / loopLengthFrames))
    let frameInLoop = absoluteFrame - Double(loopIndex) * loopLengthFrames
    return (frameInLoop, loopIndex)
  }

  /// Beat position for a frame within the loop.
  static func beat(forFrameInLoop frameInLoop: Double, bpm: Double, sampleRate: Double) -> Double {
    let fpb = framesPerBeat(bpm: bpm, sampleRate: sampleRate)
    return fpb > 0 ? frameInLoop / fpb : 0
  }
}

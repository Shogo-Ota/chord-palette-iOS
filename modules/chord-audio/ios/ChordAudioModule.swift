import AVFoundation
import ExpoModulesCore

/// JS-facing record for a single (poly)chord occurrence.
struct NoteEventRecord: Record {
  @Field var midiNotes: [Int] = []
  @Field var startBeat: Double = 0
  @Field var lengthBeats: Double = 0
  @Field var velocity: Int = 100
}

/// JS-facing generic playback request (no hard-coded progression — §3).
struct PlaybackRequestRecord: Record {
  @Field var bpm: Double = 120
  @Field var totalBeats: Double = 0
  @Field var loop: Bool = true
  @Field var chordEvents: [NoteEventRecord] = []
  @Field var drumPatternId: String = "pop8-min"
  @Field var instrument: String = "piano"
}

/// JS-facing single-chord audition request.
struct PreviewRequestRecord: Record {
  @Field var midiNotes: [Int] = []
  @Field var velocity: Int = 100
  @Field var lengthBeats: Double?
  @Field var bpm: Double?
  @Field var instrument: String = "piano"
}

/// JS-facing offline render request (Phase 4 video export). Loops the progression
/// to fill `durationSec`.
struct RenderAudioRequestRecord: Record {
  @Field var bpm: Double = 120
  @Field var totalBeats: Double = 0
  @Field var chordEvents: [NoteEventRecord] = []
  @Field var drumPatternId: String = "pop8-min"
  @Field var instrument: String = "piano"
  @Field var durationSec: Double = 15
}

/// Expo Custom Native Module bridging JS ↔ `AudioEngineController` (Phase 2A).
/// Holds no playback logic itself; it only marshals records and forwards calls.
public class ChordAudioModule: Module {
  private let controller = AudioEngineController()

  public func definition() -> ModuleDefinition {
    Name("ChordAudio")

    Events("onPosition", "onStateChange")

    OnCreate {
      self.controller.onStateChange = { [weak self] state in
        self?.sendEvent("onStateChange", ["state": state])
      }
      self.controller.onPosition = { [weak self] chordIndex, beat, loopCount in
        self?.sendEvent("onPosition", [
          "chordIndex": chordIndex,
          "beat": beat,
          "loopCount": loopCount,
        ])
      }
    }

    OnDestroy {
      self.controller.teardown()
    }

    Function("isAvailable") { () -> Bool in
      return true
    }

    Function("getVersion") { () -> String in
      // NOTE: this is a display/Phase label and is intentionally NOT the same as
      // ChordAudio.podspec's `s.version` (the pod/build version, currently 1.0.0).
      return "2B.0.0"
    }

    Function("getState") { () -> String in
      return self.controller.state.rawValue
    }

    AsyncFunction("prepare") {
      try self.controller.prepare()
    }

    AsyncFunction("teardown") {
      self.controller.teardown()
    }

    AsyncFunction("previewChord") { (req: PreviewRequestRecord) in
      let bpm = req.bpm ?? 120.0
      let lengthBeats = req.lengthBeats ?? 2.0
      let durationSec = lengthBeats * (60.0 / bpm)
      self.controller.previewChord(
        notes: req.midiNotes,
        velocity: req.velocity,
        durationSec: durationSec,
        instrument: req.instrument
      )
    }

    AsyncFunction("play") { (req: PlaybackRequestRecord) in
      let events = req.chordEvents.map { event in
        NoteEventValue(
          midiNotes: event.midiNotes,
          startBeat: event.startBeat,
          lengthBeats: event.lengthBeats,
          velocity: event.velocity
        )
      }
      self.controller.play(
        bpm: req.bpm,
        totalBeats: req.totalBeats,
        loop: req.loop,
        events: events,
        instrument: req.instrument
      )
    }

    AsyncFunction("renderAudioFile") { (req: RenderAudioRequestRecord) -> [String: Any] in
      let events = req.chordEvents.map { event in
        NoteEventValue(
          midiNotes: event.midiNotes,
          startBeat: event.startBeat,
          lengthBeats: event.lengthBeats,
          velocity: event.velocity
        )
      }
      let result = try self.controller.renderToFile(
        bpm: req.bpm,
        totalBeats: req.totalBeats,
        events: events,
        instrument: req.instrument,
        durationSec: req.durationSec
      )
      return ["uri": result.url.absoluteString, "sampleRate": result.sampleRate]
    }

    // Diagnostics: SoundFont resolution + sampled-load state, readable from JS so
    // the "synth fallback instead of real piano" root cause is observable in Metro
    // logs (Windows dev cannot read native os_log). See AudioEngineController.
    AsyncFunction("getAudioDiagnostics") { () -> [String: Any] in
      return self.controller.audioDiagnostics()
    }

    AsyncFunction("pause") {
      self.controller.pause()
    }

    AsyncFunction("resume") {
      self.controller.resume()
    }

    AsyncFunction("stop") {
      self.controller.stop()
    }

    Function("setMasterVolume") { (value: Double) in
      self.controller.setMasterVolume(Float(value))
    }

    Function("setChordVolume") { (value: Double) in
      self.controller.setChordVolume(Float(value))
    }

    Function("setDrumVolume") { (value: Double) in
      self.controller.setDrumVolume(Float(value))
    }
  }
}

import AVFoundation
import ExpoModulesCore

/// JS-facing record for a single (poly)chord occurrence.
struct NoteEventRecord: Record {
  @Field var midiNotes: [Int] = []
  @Field var startBeat: Double = 0
  @Field var lengthBeats: Double = 0
  @Field var velocity: Int = 100
}

struct CountInRecord: Record {
  @Field var beats: Int = 0
  @Field var midiNote: Int = 37
  @Field var velocity: Int = 82
  @Field var finalVelocity: Int = 104
}

/// JS-facing generic playback request (no hard-coded progression — §3).
struct PlaybackRequestRecord: Record {
  @Field var bpm: Double = 120
  @Field var totalBeats: Double = 0
  @Field var loop: Bool = true
  @Field var chordEvents: [NoteEventRecord] = []
  @Field var drumPatternId: String = "pop8-min"
  @Field var accompaniment: String = "block"
  @Field var instrument: String = "piano"
  /// Seek into the loop on start (0 = from the top). Used for live re-apply.
  @Field var startBeat: Double = 0
  /// Beats per bar for drum groove folding (default 4/4).
  @Field var beatsPerBar: Double = 4
  /// off | clap | full
  @Field var drumMode: String = "full"
  /// Optional playback-only pre-roll. Never joins the loop or exported MIDI.
  @Field var countIn: CountInRecord?

  /* -- Playback v2 (realtime sampler). Absent ⇒ the v1 pre-rendered path. ------ */

  /// `sampled` (v1, default) | `sequencer` (v2 realtime sampler).
  @Field var engine: String = "sampled"
  /// The whole plan as SMF Format 1 bytes, base64. Required by `sequencer`.
  @Field var smfBase64: String?
  /// Whether the SMF ends with a drum track (told, so native never guesses).
  @Field var hasDrums: Bool = false
  /// GM program the melodic sampler must load (0 = grand, 4 = e.piano).
  @Field var gmProgram: Int = 0
  /// Fingerprint of the Final MIDI, logged so an A/B can prove both engines got it.
  @Field var planSignature: String?
  /// Flattened MIDI schedule (note on/off + CC). Native plays this, not the SMF.
  @Field var midiEvents: [MidiEventRecord] = []
}

struct MidiEventRecord: Record {
  @Field var beat: Double = 0
  @Field var kind: String = "on"
  @Field var channel: Int = 0
  @Field var a: Int = 0
  @Field var b: Int = 0
  @Field var drum: Bool = false
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
  @Field var accompaniment: String = "block"
  @Field var instrument: String = "piano"
  @Field var durationSec: Double = 15
  /// Beats per bar for drum groove folding (default 4/4).
  @Field var beatsPerBar: Double = 4
  /// Canonical Final MIDI schedule. New binaries render this instead of rebuilding
  /// the take from chordEvents, so NoteOn/Off/CC64 match realtime playback.
  @Field var midiEvents: [MidiEventRecord] = []
  @Field var hasDrums: Bool = false
  @Field var gmProgram: Int = 0
  @Field var planSignature: String?
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

    Function("getCurrentBeat") { () -> Double in
      return self.controller.currentBeat()
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
      let startPlayback = { [weak self] in
        guard let self else { return }
        // v2 needs the flattened MIDI schedule. Without it the request falls through
        // to v1, so an older JS bundle on a newer binary still plays.
        if req.engine == "sequencer", !req.midiEvents.isEmpty {
          let midi = req.midiEvents.map { ev in
            ScheduledMidiEvent(
              beat: ev.beat,
              kind: ev.kind,
              channel: UInt8(max(0, min(15, ev.channel))),
              a: UInt8(max(0, min(127, ev.a))), // MIDI range only — not sampled 24–84
              b: UInt8(max(0, min(127, ev.b))),
              drum: ev.drum
            )
          }
          self.controller.playRealtime(
            midiEvents: midi,
            bpm: req.bpm,
            totalBeats: req.totalBeats,
            loop: req.loop,
            hasDrums: req.hasDrums,
            gmProgram: req.gmProgram,
            instrument: req.instrument,
            startBeat: req.startBeat,
            planSignature: req.planSignature,
            chordEvents: events
          )
          return
        }
        self.controller.play(
          bpm: req.bpm,
          totalBeats: req.totalBeats,
          loop: req.loop,
          events: events,
          drumPattern: req.drumPatternId,
          accompaniment: req.accompaniment,
          instrument: req.instrument,
          startBeat: req.startBeat,
          beatsPerBar: req.beatsPerBar,
          drumMode: req.drumMode
        )
      }

      // The count-in is a promise that music is ready at its boundary. Resolve the
      // request-specific realtime instrument before starting that clock; otherwise
      // the first cold SoundFont load occurs after the final click. The same method
      // is called again inside playRealtime as an idempotent safety guard.
      let realtimeReady =
        req.engine != "sequencer" || req.midiEvents.isEmpty
        || self.controller.prepareRealtimeInstrument(
          req.instrument,
          gmProgram: req.gmProgram,
          hasDrums: req.hasDrums)

      if !realtimeReady {
        startPlayback()
        return
      }

      if let countIn = req.countIn, countIn.beats > 0, req.startBeat <= 0 {
        let config = CountInConfigValue(
          beats: max(1, min(8, countIn.beats)),
          midiNote: UInt8(max(0, min(127, countIn.midiNote))),
          velocity: UInt8(max(1, min(127, countIn.velocity))),
          finalVelocity: UInt8(max(1, min(127, countIn.finalVelocity)))
        )
        self.controller.playAfterCountIn(
          config: config,
          bpm: req.bpm,
          planSignature: req.planSignature,
          start: startPlayback)
      } else {
        startPlayback()
      }
    }

    AsyncFunction("renderAudioFile") { (req: RenderAudioRequestRecord) -> [String: Any] in
      if !req.midiEvents.isEmpty {
        let midi = req.midiEvents.map { ev in
          ScheduledMidiEvent(
            beat: ev.beat,
            kind: ev.kind,
            channel: UInt8(max(0, min(15, ev.channel))),
            a: UInt8(max(0, min(127, ev.a))),
            b: UInt8(max(0, min(127, ev.b))),
            drum: ev.drum
          )
        }
        let result = try self.controller.renderMidiToFile(
          bpm: req.bpm,
          durationSec: req.durationSec,
          events: midi,
          instrument: req.instrument,
          gmProgram: req.gmProgram,
          hasDrums: req.hasDrums,
          planSignature: req.planSignature
        )
        return ["uri": result.url.absoluteString, "sampleRate": result.sampleRate]
      }

      // Backward-compatible fallback for callers that predate canonical MIDI export.
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
        drumPattern: req.drumPatternId,
        accompaniment: req.accompaniment,
        instrument: req.instrument,
        durationSec: req.durationSec,
        beatsPerBar: req.beatsPerBar
      )
      return ["uri": result.url.absoluteString, "sampleRate": result.sampleRate]
    }

    // Diagnostics: SoundFont resolution + sampled-load state, readable from JS so
    // the "synth fallback instead of real piano" root cause is observable in Metro
    // logs (Windows dev cannot read native os_log). See AudioEngineController.
    AsyncFunction("getAudioDiagnostics") { () -> [String: Any] in
      return self.controller.audioDiagnostics()
    }

    // Playback lifecycle timeline + polyphony stats (v1.01 Phase 1): recent
    // play/pause/stop/interruption/route-change events plus peak polyphony and
    // the scheduled note range, so the state leading up to a rare failure (the
    // "low notes only" report) can be read back from JS after the fact.
    AsyncFunction("getPlaybackDiagnostics") { () -> [String: Any] in
      return self.controller.playbackDiagnostics()
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

    /// Hot-swap the chord voice without restarting transport (position preserved).
    AsyncFunction("setInstrument") { (instrumentId: String) in
      self.controller.setInstrument(instrumentId)
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

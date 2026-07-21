import Foundation

/// Clean electric-piano voice used for the free `ePiano` instrument.
///
/// FluidR3's GM Electric Piano presets bake in chorus / tine hash that survives
/// offline capture as a constant "noise" bed. Rather than fighting the soundfont,
/// we synthesize a refined Rhodes-like tone. To keep it 癖 (quirk) -free the
/// spectrum is built from INTEGER harmonics only (no detuned/inharmonic partial)
/// and the attack "tine" is a soft, fast-decaying integer harmonic — so it pings
/// cleanly and sits as a smooth, sophisticated EP rather than a metallic one.
final class ElectricPianoInstrumentProvider: InstrumentProvider {
  private let attack: Double = 0.005
  private let release: Double = 0.08
  private let sustainLevel: Float = 0.85
  private let gain: Float = 0.32

  func sample(note: Int, tSeconds: Double, durationSeconds: Double) -> Float {
    if tSeconds < 0 || tSeconds >= durationSeconds { return 0 }
    let freq = Scheduler.frequency(forMidi: note)
    let env = envelope(tSeconds: tSeconds, durationSeconds: durationSeconds)

    // Warm, clean body: fundamental + gentle integer harmonics only. The soft
    // 2nd (octave) gives body; a trace 3rd adds warmth without harshness. No
    // inharmonic/detuned partial → none of the metallic 癖 of the SoundFont EP.
    let phase = 2.0 * Double.pi * freq * tSeconds
    let body = sin(phase) + 0.16 * sin(2.0 * phase) + 0.04 * sin(3.0 * phase)

    // Bell / tine: a soft integer-harmonic (4th) ping that decays in ~90 ms —
    // the characteristic EP attack, but harmonically locked so it stays clean
    // (no beating/detune) instead of ringing metallic.
    let tineEnv = exp(-tSeconds * 16.0)
    let tine = sin(4.0 * phase) * tineEnv * 0.10

    return Float(body * Double(env) + tine) * gain
  }

  private func envelope(tSeconds: Double, durationSeconds: Double) -> Float {
    let releaseStart = max(attack, durationSeconds - release)
    if tSeconds < attack {
      return Float(tSeconds / attack) * sustainLevel
    }
    // Gentle natural decay so held chords don't sit as a flat organ tone.
    let decay = Float(exp(-(tSeconds - attack) * 0.55))
    let sustained = sustainLevel * (0.55 + 0.45 * decay)
    if tSeconds >= releaseStart {
      let r = (durationSeconds - tSeconds) / release
      return Float(max(0.0, min(1.0, r))) * sustained
    }
    return sustained
  }
}

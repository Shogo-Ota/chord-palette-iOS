import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const iosSource = (name: string) =>
  readFileSync(resolve(process.cwd(), 'modules/chord-audio/ios', name), 'utf8');

describe('native sample-clock scheduling contract', () => {
  it('schedules current-buffer MIDI with an Audio Unit frame offset', () => {
    const scheduler = iosSource('SampleAccurateMidiScheduler.swift');

    expect(scheduler).toContain('token(byAddingRenderObserver:');
    expect(scheduler).toContain('.unitRenderAction_PreRender');
    expect(scheduler).toContain('AUEventSampleTimeImmediate + offset');
    expect(scheduler).toContain('let origin = clock.origin(for: timestamp)');
  });

  it('uses one shared render origin for chord and drum samplers', () => {
    const engine = iosSource('RealtimeSamplerEngine.swift');

    expect(engine).toContain('private let renderClock = SampleAccurateMidiClock()');
    expect(engine.match(/clock: renderClock/g)).toHaveLength(2);
    expect(engine).toContain('"scheduler": "audio-render-clock"');
  });

  it('does not schedule accompaniment events with DispatchQueue timers', () => {
    const engine = iosSource('RealtimeSamplerEngine.swift');

    expect(engine).not.toContain('private func scheduleEvents(');
    expect(engine).not.toContain('private func armNextLoop(');
    expect(engine).not.toContain('app.chord-palette.realtime-midi');
  });

  it('resolves overlapping same-pitch lifetimes before entering the render callback', () => {
    const engine = iosSource('RealtimeSamplerEngine.swift');
    const scheduler = iosSource('SampleAccurateMidiScheduler.swift');

    expect(engine).toContain('let schedulableChordEvents = prepareChordEvents(');
    expect(engine).toContain('samePitchGate.reset(resetDiagnostics: false)');
    expect(scheduler).not.toContain('SamePitchNoteGate');
  });
});

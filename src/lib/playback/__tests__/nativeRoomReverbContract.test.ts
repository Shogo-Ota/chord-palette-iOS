import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const iosSource = (name: string) =>
  readFileSync(resolve(process.cwd(), 'modules/chord-audio/ios', name), 'utf8');

describe('native room reverb contract', () => {
  it('routes only the realtime chord sampler through a small-room reverb node', () => {
    const source = iosSource('RealtimeSamplerEngine.swift');

    expect(source).toContain('private let chordReverb = AVAudioUnitReverb()');
    expect(source).toContain('chordReverb.loadFactoryPreset(.smallRoom)');
    expect(source).toContain('engine.connect(chordSampler, to: chordReverb');
    expect(source).toContain('engine.connect(chordReverb, to: chordBus');
    expect(source).toContain('engine.connect(drumSampler, to: drumBus');
  });

  it('uses the same room preset and wet percentage in offline video audio', () => {
    const source = iosSource('OfflineMidiRenderer.swift');

    expect(source).toContain('let chordReverb = AVAudioUnitReverb()');
    expect(source).toContain('chordReverb.loadFactoryPreset(.smallRoom)');
    expect(source).toContain('reverbPreset == "smallRoom"');
    expect(source).toContain('Float(max(0, min(100, reverbWetDryMix)))');
  });

  it('keeps older requests dry at the native bridge', () => {
    const source = iosSource('ChordAudioModule.swift');

    expect(source.match(/@Field var reverbPreset: String = "off"/g)).toHaveLength(2);
    expect(source.match(/@Field var reverbWetDryMix: Double = 0/g)).toHaveLength(2);
  });
});

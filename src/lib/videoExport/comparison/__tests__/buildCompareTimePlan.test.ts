import { snapshot } from '@/lib/comparison/testing/fixtures';
import { buildCompareTimePlan } from '@/lib/videoExport/comparison';

function variantProgression() {
  return snapshot().progression.map((event, index) =>
    index === 2
      ? {
          ...event,
          chordId: '5:minor',
          displayName: 'Fm',
          suffix: 'm',
          definitionId: 'minor',
        }
      : { ...event },
  );
}

describe('buildCompareTimePlan', () => {
  it('builds the exact 100 BPM A+B 19.2-second fixture at 48 kHz', () => {
    const result = buildCompareTimePlan({
      base: snapshot(),
      variant: snapshot({ progression: variantProgression() }),
      sampleRate: 48_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.durationSamples).toBe(921_600);
    expect(result.value.durationSamples / result.value.sampleRate).toBe(19.2);
    expect(result.value.segments).toEqual([
      expect.objectContaining({
        role: 'base',
        startSample: 0,
        durationSamples: 460_800,
      }),
      expect.objectContaining({
        role: 'variant',
        startSample: 460_800,
        durationSamples: 460_800,
      }),
    ]);
    expect(result.value.harmonyEvents.map((event) => event.startSample)).toEqual([
      0, 115_200, 230_400, 345_600, 460_800, 576_000, 691_200, 806_400,
    ]);
  });

  it('uses cumulative musical boundaries without per-event rounding drift', () => {
    const result = buildCompareTimePlan({
      base: snapshot({ tempoBpm: 137 }),
      variant: snapshot({
        tempoBpm: 137,
        progression: variantProgression(),
      }),
      sampleRate: 44_100,
    });
    if (!result.ok) throw new Error(result.reason);

    const baseEvents = result.value.harmonyEvents.filter((event) => event.role === 'base');
    const baseEnd = baseEvents.reduce(
      (max, event) => Math.max(max, event.startSample + event.durationSamples),
      0,
    );
    expect(baseEnd).toBe(result.value.segments[0].durationSamples);
    expect(result.value.segments[1].startSample).toBe(baseEnd);
    expect(result.value.durationSamples).toBe(result.value.segments[0].durationSamples * 2);
  });

  it('respects remetered accompaniment beats instead of forcing 4/4', () => {
    const result = buildCompareTimePlan({
      base: snapshot({ accompanimentPattern: 'waltz' }),
      variant: snapshot({
        accompanimentPattern: 'waltz',
        progression: variantProgression(),
      }),
      sampleRate: 48_000,
    });
    if (!result.ok) throw new Error(result.reason);

    expect(result.value.segments[0].durationSamples).toBe(345_600);
    expect(result.value.durationSamples / 48_000).toBe(14.4);
  });

  it.each([40, 300])('keeps safe integer boundaries at BPM %s', (tempoBpm) => {
    const result = buildCompareTimePlan({
      base: snapshot({ tempoBpm }),
      variant: snapshot({ tempoBpm, progression: variantProgression() }),
      sampleRate: 48_000,
    });
    if (!result.ok) throw new Error(result.reason);

    expect(Number.isSafeInteger(result.value.durationSamples)).toBe(true);
    expect(
      result.value.harmonyEvents.every(
        (event) =>
          Number.isSafeInteger(event.startSample) && Number.isSafeInteger(event.durationSamples),
      ),
    ).toBe(true);
  });

  it.each([
    [0, 'INVALID_SAMPLE_RATE'],
    [48_000.5, 'INVALID_SAMPLE_RATE'],
    [500_000, 'INVALID_SAMPLE_RATE'],
  ])('rejects invalid sample rate %s', (sampleRate, reason) => {
    expect(
      buildCompareTimePlan({
        base: snapshot(),
        variant: snapshot({ progression: variantProgression() }),
        sampleRate,
      }),
    ).toEqual({ ok: false, reason });
  });

  it('rejects an incompatible pair before constructing media timing', () => {
    expect(
      buildCompareTimePlan({
        base: snapshot(),
        variant: snapshot(),
        sampleRate: 48_000,
      }),
    ).toEqual({ ok: false, reason: 'IDENTICAL' });
  });
});

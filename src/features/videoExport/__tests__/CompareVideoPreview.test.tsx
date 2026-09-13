import { render } from '@testing-library/react-native';

import { semanticHarmonyDiff } from '@/lib/comparison';
import { comparisonSource, snapshot } from '@/lib/comparison/testing/fixtures';
import { buildCompareSceneManifest, buildCompareTimePlan } from '@/lib/videoExport/comparison';

import { CompareVideoPreview } from '../CompareVideoPreview';

function scene() {
  const base = snapshot();
  const progression = comparisonSource().progression.map((event, index) =>
    index === 2
      ? {
          ...event,
          chordId: '5:minor',
          displayName: 'Fm',
          suffix: 'm',
          definitionId: 'minor',
        }
      : event,
  );
  const variant = snapshot({ progression });
  const time = buildCompareTimePlan({
    base,
    variant,
    sampleRate: 48_000,
  });
  if (!time.ok) throw new Error(time.reason);
  return buildCompareSceneManifest({
    base,
    variant,
    timePlan: time.value,
    changes: semanticHarmonyDiff(base, variant),
    motion: 'reduced',
  });
}

describe('CompareVideoPreview', () => {
  it('renders the same manifest copy, role, cards and official product name', () => {
    const view = render(<CompareVideoPreview scene={scene()} />);

    expect(view.getByText('3つ目を変えると？')).toBeTruthy();
    expect(view.getByText('原型')).toBeTruthy();
    expect(view.getAllByText('C').length).toBeGreaterThan(0);
    expect(view.getByText(/NEXT\s+Am/)).toBeTruthy();
    expect(view.getByText('Chord Palette')).toBeTruthy();
  });

  it('shows preparation and recoverable error states without fake content', () => {
    const preparing = render(<CompareVideoPreview scene={null} preparing />);
    expect(preparing.getByText('聴き比べを準備中…')).toBeTruthy();

    const failed = render(<CompareVideoPreview scene={null} error="準備に失敗しました。" />);
    expect(failed.getByText('準備に失敗しました。')).toBeTruthy();
  });
});

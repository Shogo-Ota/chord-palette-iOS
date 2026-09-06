import { fireEvent, render } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';

import { CPChordEvolutionSheet, type CPChordEvolutionSheetProps } from '../CPChordEvolutionSheet';

function props(): CPChordEvolutionSheetProps {
  return {
    visible: true,
    scopeLabel: '進行全体',
    activeLevel: 'reharm',
    levels: [
      { level: 'original', label: 'Original' },
      { level: 'seventh', label: '7th' },
      { level: 'tension', label: 'Rich' },
      { level: 'reharm', label: 'Reharm' },
    ],
    originalSummary: 'C · Am · F · G',
    candidates: [
      {
        id: 'reharm-1',
        title: 'セカンダリードミナント',
        summary: 'C · E7 · Am · F · G',
        changedCount: 1,
        rationale: '解決先へ向かうドミナントを加えて、進行感を強くします。',
        applyLocked: true,
        applyLabel: 'Proで適用',
      },
    ],
    onRequestClose: jest.fn(),
    onSelectLevel: jest.fn(),
    onPreviewOriginal: jest.fn(),
    onPreviewCandidate: jest.fn(),
    onApplyCandidate: jest.fn(),
  };
}

describe('CPChordEvolutionSheet Reharm', () => {
  it('renders an accessible fourth tab and concise rationale', () => {
    const sheetProps = props();
    const view = render(<CPChordEvolutionSheet {...sheetProps} />);
    expect(view.getByLabelText('Reharmレベル').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(view.getByText('解決先へ向かうドミナントを加えて、進行感を強くします。')).toBeTruthy();
    expect(view.getByText('Reharm').props).toMatchObject({
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.72,
      maxFontSizeMultiplier: 1.2,
    });
    expect(StyleSheet.flatten(view.UNSAFE_getByType(ScrollView).props.style)).toMatchObject({
      flex: 1,
    });

    fireEvent.press(view.getByLabelText('Originalレベル'));
    fireEvent.press(view.getByLabelText('セカンダリードミナント候補1を試聴'));
    fireEvent.press(view.getByLabelText('セカンダリードミナント候補1をProで適用'));
    fireEvent.press(view.getByLabelText('コード発展の背景を閉じる'));
    expect(sheetProps.onSelectLevel).toHaveBeenCalledWith('original');
    expect(sheetProps.onPreviewCandidate).toHaveBeenCalledWith('reharm-1');
    expect(sheetProps.onApplyCandidate).toHaveBeenCalledWith('reharm-1');
    expect(sheetProps.onRequestClose).toHaveBeenCalledTimes(1);
  });
});

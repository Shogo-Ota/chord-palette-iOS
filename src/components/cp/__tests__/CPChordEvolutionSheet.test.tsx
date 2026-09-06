import { fireEvent, render } from '@testing-library/react-native';

import { CPChordContextMenu } from '../CPChordContextMenu';
import { CPChordEvolutionSheet, type CPChordEvolutionSheetProps } from '../CPChordEvolutionSheet';

const levels = [
  { level: 'original', label: 'Original' },
  { level: 'seventh', label: '7th' },
  { level: 'tension', label: 'Rich' },
] as const;

function props(overrides: Partial<CPChordEvolutionSheetProps> = {}): CPChordEvolutionSheetProps {
  return {
    visible: true,
    scopeLabel: '進行全体',
    activeLevel: 'original',
    levels,
    originalSummary: 'C · Am · F · G',
    candidates: [],
    onRequestClose: jest.fn(),
    onSelectLevel: jest.fn(),
    onPreviewOriginal: jest.fn(),
    onPreviewCandidate: jest.fn(),
    onApplyCandidate: jest.fn(),
    ...overrides,
  };
}

describe('CPChordEvolutionSheet', () => {
  it('shows the three beginner-facing levels and Original', () => {
    const view = render(<CPChordEvolutionSheet {...props()} />);
    expect(view.getByText('コードを発展')).toBeTruthy();
    expect(view.getByLabelText('Originalレベル')).toBeTruthy();
    expect(view.getByLabelText('7thレベル')).toBeTruthy();
    expect(view.getByLabelText('Richレベル')).toBeTruthy();
    expect(view.getByText('C · Am · F · G')).toBeTruthy();
    expect(view.getByLabelText('Originalを試聴').props.accessibilityRole).toBe('button');
    expect(view.getByLabelText('Originalレベル').props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('forwards level, Preview, Apply and close exactly once per press', () => {
    const onSelectLevel = jest.fn();
    const onPreviewCandidate = jest.fn();
    const onApplyCandidate = jest.fn();
    const onRequestClose = jest.fn();
    const view = render(
      <CPChordEvolutionSheet
        {...props({
          activeLevel: 'seventh',
          onSelectLevel,
          onPreviewCandidate,
          onApplyCandidate,
          onRequestClose,
          candidates: [
            {
              id: 'candidate-1',
              title: '7thコード',
              summary: 'C → Cmaj7',
              changedCount: 1,
              applyLocked: false,
              applyLabel: '適用',
            },
          ],
        })}
      />,
    );

    fireEvent.press(view.getByLabelText('Richレベル'));
    fireEvent.press(view.getByLabelText('7thコード候補1を試聴'));
    fireEvent.press(view.getByLabelText('7thコード候補1を適用'));
    fireEvent.press(view.getByLabelText('コード発展を閉じる'));

    expect(onSelectLevel).toHaveBeenCalledTimes(1);
    expect(onSelectLevel).toHaveBeenCalledWith('tension');
    expect(onPreviewCandidate).toHaveBeenCalledTimes(1);
    expect(onApplyCandidate).toHaveBeenCalledTimes(1);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('keeps L2 Preview active while rendering a locked Pro Apply', () => {
    const onPreviewCandidate = jest.fn();
    const onApplyCandidate = jest.fn();
    const view = render(
      <CPChordEvolutionSheet
        {...props({
          activeLevel: 'tension',
          onPreviewCandidate,
          onApplyCandidate,
          candidates: [
            {
              id: 'rich-1',
              title: 'テンション',
              summary: 'Cmaj7 → Cmaj9',
              changedCount: 1,
              applyLocked: true,
              applyLabel: 'Proで適用',
            },
          ],
        })}
      />,
    );

    fireEvent.press(view.getByLabelText('テンション候補1を試聴'));
    fireEvent.press(view.getByLabelText('テンション候補1をProで適用'));
    expect(onPreviewCandidate).toHaveBeenCalledWith('rich-1');
    expect(onApplyCandidate).toHaveBeenCalledWith('rich-1');
  });

  it('renders the safe zero-candidate message', () => {
    const view = render(
      <CPChordEvolutionSheet
        {...props({
          activeLevel: 'tension',
          emptyMessage: 'このレベルの候補はありません',
        })}
      />,
    );
    expect(view.getByText('このレベルの候補はありません')).toBeTruthy();
  });
});

describe('CPChordContextMenu Evolution entry', () => {
  it('shows an accessible single-chord entry and calls it once', () => {
    const onEvolve = jest.fn();
    const view = render(
      <CPChordContextMenu
        visible
        chordLabel="C"
        degreeLabel="I"
        durationBeats={4}
        voicingPosition="root"
        context={{
          visible: true,
          canDuplicate: true,
          canMoveLeft: false,
          canMoveRight: false,
          canDelete: true,
          canEditDuration: true,
          canEditVoicing: true,
          canEvolve: true,
        }}
        onRequestClose={jest.fn()}
        onEvolve={onEvolve}
        onDuplicate={jest.fn()}
        onMoveLeft={jest.fn()}
        onMoveRight={jest.fn()}
        onDelete={jest.fn()}
        onSetDuration={jest.fn()}
        onSetVoicingPosition={jest.fn()}
      />,
    );
    const entry = view.getByLabelText('このコードを発展');
    expect(entry.props.accessibilityRole).toBe('button');
    fireEvent.press(entry);
    expect(onEvolve).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, render } from '@testing-library/react-native';

import { CPChordMetaLine } from '../CPChordMetaLine';
import { CPChordStyleSheet } from '../CPChordStyleSheet';
import { CHORD_STYLE_OVERRIDE_OPTIONS } from '@/features/editor/chordStyleOverrideOptions';

describe('CPChordStyleSheet', () => {
  it('shows only the eight public STYLE choices and Global inheritance', () => {
    const view = render(
      <CPChordStyleSheet
        visible
        chordLabel="F"
        globalStyleLabel="Natural Type 1"
        locked={false}
        onRequestClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    expect(CHORD_STYLE_OVERRIDE_OPTIONS).toHaveLength(8);
    for (const option of CHORD_STYLE_OVERRIDE_OPTIONS) {
      expect(view.getByLabelText(option.displayLabel)).toBeTruthy();
    }
    expect(view.getByLabelText('全体のSTYLEを使用')).toBeTruthy();
    expect(CHORD_STYLE_OVERRIDE_OPTIONS.some((option) => option.pattern === 'arpeggio')).toBe(
      false,
    );
  });

  it('returns stable ids rather than display labels', () => {
    const onSelect = jest.fn();
    const view = render(
      <CPChordStyleSheet
        visible
        chordLabel="F"
        globalStyleLabel="Natural Type 1"
        value={{ pattern: 'city', variant: 'city.type1' }}
        locked={false}
        onRequestClose={jest.fn()}
        onSelect={onSelect}
      />,
    );

    expect(view.getByLabelText('Variation City').props.accessibilityState).toEqual({
      selected: true,
    });
    fireEvent.press(view.getByLabelText('Arpeggio Type 1'));
    expect(onSelect).toHaveBeenCalledWith({
      pattern: 'natural',
      variant: 'natural.type5',
    });

    fireEvent.press(view.getByLabelText('全体のSTYLEを使用'));
    expect(onSelect).toHaveBeenLastCalledWith(undefined);
  });

  it('announces Pro access without disabling the Paywall action', () => {
    const onSelect = jest.fn();
    const view = render(
      <CPChordStyleSheet
        visible
        chordLabel="F"
        globalStyleLabel="Natural Type 1"
        locked
        onRequestClose={jest.fn()}
        onSelect={onSelect}
      />,
    );
    const option = view.getByLabelText('Variation City');

    expect(option.props.accessibilityHint).toBe('Palette Proへの登録後に設定できます');
    fireEvent.press(option);
    expect(onSelect).toHaveBeenCalled();
  });
});

describe('CPChordMetaLine compact layout', () => {
  it('keeps degree, voicing and STYLE on one truncated line for a 1/4 card', () => {
    const view = render(<CPChordMetaLine degreeLabel="IV" voicingBadge="1st" styleBadge="Arp" />);
    const line = view.getByLabelText('IV、1st、Arp');

    expect(line.props.numberOfLines).toBe(1);
    expect(line.props.ellipsizeMode).toBe('tail');
    expect(view.getByText('IV · 1st · Arp')).toBeTruthy();
  });

  it('keeps the previous degree/voicing text when no override exists', () => {
    const view = render(<CPChordMetaLine degreeLabel="IV" voicingBadge="1st" />);

    expect(view.getByText('IV · 1st')).toBeTruthy();
    expect(view.queryByText(/Arp|City|Funk|Dance/)).toBeNull();
  });
});

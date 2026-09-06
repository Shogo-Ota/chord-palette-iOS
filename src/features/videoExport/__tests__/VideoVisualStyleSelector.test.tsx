import { fireEvent, render } from '@testing-library/react-native';

import { VideoVisualStyleSelector } from '../VideoVisualStyleSelector';

describe('VideoVisualStyleSelector', () => {
  it('shows the three concise options with Classic selected by default value', () => {
    const view = render(<VideoVisualStyleSelector value="classic" onChange={jest.fn()} />);

    expect(view.getByText('動画スタイル')).toBeTruthy();
    expect(view.getByText('クラシック')).toBeTruthy();
    expect(view.getByText('パルス')).toBeTruthy();
    expect(view.getByText('フロー')).toBeTruthy();
    expect(view.getByText('シンプル')).toBeTruthy();
    expect(view.getByText('リズムと進行を強調')).toBeTruthy();
    expect(view.getByText('なめらかな流れ')).toBeTruthy();
    expect(view.getByLabelText('クラシック、シンプル').props.accessibilityState).toEqual({
      selected: true,
      disabled: false,
    });
  });

  it.each([
    ['クラシック、シンプル', 'classic'],
    ['パルス、リズムと進行を強調', 'pulse'],
    ['フロー、なめらかな流れ', 'flow'],
  ] as const)('forwards %s as %s', (accessibilityLabel, expected) => {
    const onChange = jest.fn();
    const view = render(<VideoVisualStyleSelector value="classic" onChange={onChange} />);

    const option = view.getByLabelText(accessibilityLabel);
    expect(option.props.accessibilityRole).toBe('radio');
    fireEvent.press(option);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it('disables every option while export is running', () => {
    const onChange = jest.fn();
    const view = render(<VideoVisualStyleSelector value="pulse" onChange={onChange} disabled />);

    const pulse = view.getByLabelText('パルス、リズムと進行を強調');
    expect(pulse.props.accessibilityState).toEqual({
      selected: true,
      disabled: true,
    });
    fireEvent.press(pulse);
    expect(onChange).not.toHaveBeenCalled();
  });
});

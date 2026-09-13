import { fireEvent, render } from '@testing-library/react-native';

import { VideoTemplateSelector } from '../VideoTemplateSelector';

describe('VideoTemplateSelector', () => {
  it('keeps Standard selected and explains unavailable Compare', () => {
    const view = render(
      <VideoTemplateSelector
        value="standard"
        onChange={jest.fn()}
        compareEnabled={false}
        compareReason="Evolution候補を適用してください。"
      />,
    );

    expect(view.getByText('動画の構成')).toBeTruthy();
    expect(view.getByText('Evolution候補を適用してください。')).toBeTruthy();
    expect(view.getByLabelText('聴き比べ、原型 → 変奏').props.accessibilityState).toEqual({
      selected: false,
      disabled: true,
    });
  });

  it('allows an available Compare without changing visual style', () => {
    const onChange = jest.fn();
    const view = render(
      <VideoTemplateSelector value="standard" onChange={onChange} compareEnabled />,
    );

    fireEvent.press(view.getByLabelText('聴き比べ、原型 → 変奏'));
    expect(onChange).toHaveBeenCalledWith('compare');
  });
});

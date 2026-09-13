import {
  normalizeVideoVisualStyle,
  VIDEO_VISUAL_STYLES,
  type VideoVisualStyle,
} from '../videoVisualStyle';

describe('video visual style contract', () => {
  it('registers exactly Classic and Flow with matching ids', () => {
    expect(Object.keys(VIDEO_VISUAL_STYLES)).toEqual(['classic', 'flow']);
    for (const [id, definition] of Object.entries(VIDEO_VISUAL_STYLES)) {
      expect(definition.id).toBe(id);
      expect(definition.label).not.toBe('');
      expect(definition.description).not.toBe('');
    }
  });

  it.each([
    ['classic', 'classic'],
    ['flow', 'flow'],
  ] as const)('preserves valid style %s', (input, expected) => {
    expect(normalizeVideoVisualStyle(input)).toBe(expected);
  });

  it.each([undefined, null, '', 'evolution', 'pulse', 'PULSE', 0, {}, []])(
    'normalizes missing or invalid value %p to Classic',
    (input) => {
      expect(normalizeVideoVisualStyle(input)).toBe('classic');
    },
  );

  it('keeps the public union constrained to registered ids', () => {
    const styles: VideoVisualStyle[] = ['classic', 'flow'];
    expect(styles).toEqual(Object.keys(VIDEO_VISUAL_STYLES));
  });
});

import {
  MAJOR_BACKDOOR_DOMINANT_PALETTE,
  MAJOR_CHROMATIC_MEDIANT_PALETTE,
  MAJOR_PASSING_DIMINISHED_PALETTE,
} from '@/lib/musicTheory';

describe('advanced palette provenance', () => {
  it('separates the book-supported diminished technique from the curated app shortlist', () => {
    for (const rule of MAJOR_PASSING_DIMINISHED_PALETTE) {
      expect(rule.source.some((source) => source.kind === 'BOOK_EXPLICIT')).toBe(true);
      expect(rule.source.some((source) => source.kind === 'APP_POLICY_PROPOSED')).toBe(true);
    }
  });

  it('does not attribute backdoor or chromatic-mediant shortlist decisions to the book DB', () => {
    expect(
      MAJOR_BACKDOOR_DOMINANT_PALETTE.source.every(
        (source) => source.kind === 'APP_POLICY_PROPOSED',
      ),
    ).toBe(true);
    expect(
      MAJOR_CHROMATIC_MEDIANT_PALETTE.flatMap((rule) => rule.source).every(
        (source) => source.kind === 'APP_POLICY_PROPOSED',
      ),
    ).toBe(true);
  });
});

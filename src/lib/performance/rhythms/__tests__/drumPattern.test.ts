import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { profileFor } from '@/lib/performance/groove/drumProfiles';
import { RHYTHMS, drumPatternFor } from '@/lib/performance/rhythms';

/** The five rhythms that own their meter or hop and must bring their own kit. */
const OVERRIDDEN = ['shuffle', 'swing', 'reggae', 'sixEight', 'waltz'] as const;

describe('drumPatternFor', () => {
  it('leaves the player’s groove pick alone for the ordinary rhythms', () => {
    const ordinary = RHYTHMS.map((r) => r.id).filter(
      (id) => !(OVERRIDDEN as readonly string[]).includes(id),
    );
    for (const id of ordinary) {
      expect(drumPatternFor('pop8', id)).toBe('pop8');
      expect(drumPatternFor('soul16', id)).toBe('soul16');
    }
  });

  it('overrides the pick where the rhythm owns the meter or the hop', () => {
    // A waltz under a 4/4 kit wraps every four beats and fights the oom-pah;
    // a shuffle under straight hats hops in the piano alone.
    for (const id of OVERRIDDEN) {
      expect(drumPatternFor('pop8', id)).toBe(id);
    }
  });
});

describe('the overrides name kits that actually exist', () => {
  // A drum pattern id the native engine does not know is not a type error — it is
  // silence (or a fallback groove) on the device only, which is the most expensive
  // place to find out. DrumKit.swift asks to be kept in sync; this reads it.
  const swift = readFileSync(
    join(__dirname, '../../../../../modules/chord-audio/ios/DrumKit.swift'),
    'utf8',
  );
  const declared = swift.slice(
    swift.indexOf('static let grooveIds'),
    swift.indexOf(']', swift.indexOf('static let grooveIds')),
  );
  const nativeIds = [...declared.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  it('found the native list', () => {
    expect(nativeIds).toContain('pop8');
    expect(nativeIds.length).toBeGreaterThanOrEqual(13);
  });

  it('every override resolves to a kit the native engine pre-resolves', () => {
    for (const id of OVERRIDDEN) expect(nativeIds).toContain(drumPatternFor('pop8', id));
  });

  it('every override also has a JS profile, so the piano locks to the same beats', () => {
    for (const id of OVERRIDDEN) {
      const profile = profileFor(id);
      // profileFor falls back to pop8 for anything it does not know; an override
      // that silently became pop8 would let the piano and the kit drift apart.
      expect(profile).not.toEqual(profileFor('pop8'));
    }
  });
});

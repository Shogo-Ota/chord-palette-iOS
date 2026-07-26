import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';
import { FREE_KEYS, isKeyFree, isKeyLocked } from '@/lib/keyAccess';
import { MAJOR_KEYS } from '@/data/music';

const PRO: Entitlements = { palettePro: true, communityPlus: false };
const FREE: Entitlements = NO_ENTITLEMENTS;

describe('keyAccess', () => {
  it('lets a free player write in any key', () => {
    for (const k of MAJOR_KEYS) {
      expect({ key: k, locked: isKeyLocked(k, FREE) }).toEqual({ key: k, locked: false });
    }
  });

  it('lets a subscriber write in any key', () => {
    for (const k of MAJOR_KEYS) {
      expect({ key: k, locked: isKeyLocked(k, PRO) }).toEqual({ key: k, locked: false });
    }
  });

  it('keeps C reachable no matter what the tier allows', () => {
    // The floor under the capability: withdraw `key.transpose` and a player must
    // still be able to get back to a key they are entitled to.
    expect([...FREE_KEYS]).toEqual(['C']);
    expect(isKeyFree('C')).toBe(true);
    for (const k of MAJOR_KEYS) {
      if (k === 'C') continue;
      expect(isKeyFree(k)).toBe(false);
    }
  });
});

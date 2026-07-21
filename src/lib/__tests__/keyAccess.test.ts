import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';
import { FREE_KEYS, isKeyFree, isKeyLocked } from '@/lib/keyAccess';
import { MAJOR_KEYS } from '@/data/music';

const PRO: Entitlements = { palettePro: true, communityPlus: false };
const FREE: Entitlements = NO_ENTITLEMENTS;

describe('keyAccess', () => {
  it('exposes C as the only free key', () => {
    expect([...FREE_KEYS]).toEqual(['C']);
    expect(isKeyFree('C')).toBe(true);
  });

  it('marks every non-C key as not free', () => {
    for (const k of MAJOR_KEYS) {
      if (k === 'C') continue;
      expect(isKeyFree(k)).toBe(false);
    }
  });

  it('locks non-C keys for free users', () => {
    expect(isKeyLocked('C', FREE)).toBe(false);
    for (const k of MAJOR_KEYS) {
      if (k === 'C') continue;
      expect(isKeyLocked(k, FREE)).toBe(true);
    }
  });

  it('unlocks all keys for Palette Pro users', () => {
    for (const k of MAJOR_KEYS) {
      expect(isKeyLocked(k, PRO)).toBe(false);
    }
  });

  it('always allows returning to a free key regardless of tier', () => {
    expect(isKeyLocked('C', FREE)).toBe(false);
    expect(isKeyLocked('C', PRO)).toBe(false);
  });
});

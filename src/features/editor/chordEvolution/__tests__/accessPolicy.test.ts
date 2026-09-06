import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';

import { evolutionCandidateAccess } from '../accessPolicy';

const PRO_ENTITLEMENTS: Entitlements = {
  palettePro: true,
  communityPlus: false,
};

describe('Chord Evolution access policy', () => {
  it('allows L1 Preview and Apply for free users', () => {
    expect(evolutionCandidateAccess({ requiredTier: 'FREE' }, NO_ENTITLEMENTS)).toEqual({
      canPreview: true,
      canApply: true,
      requiresPro: false,
    });
  });

  it('allows L2 Preview but blocks only Apply for free users', () => {
    expect(evolutionCandidateAccess({ requiredTier: 'PRO' }, NO_ENTITLEMENTS)).toEqual({
      canPreview: true,
      canApply: false,
      requiresPro: true,
    });
  });

  it('allows L2 Apply for Palette Pro', () => {
    expect(evolutionCandidateAccess({ requiredTier: 'PRO' }, PRO_ENTITLEMENTS).canApply).toBe(true);
  });
});

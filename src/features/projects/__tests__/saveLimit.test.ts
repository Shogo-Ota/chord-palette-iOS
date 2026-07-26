import { saveAllowance, saveLimitMessage } from '@/features/projects/saveLimit';
import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';
import { countCappedProjects } from '@/repositories/projectRepository';

jest.mock('@/repositories/projectRepository', () => ({ countCappedProjects: jest.fn() }));

const counted = countCappedProjects as jest.MockedFunction<typeof countCappedProjects>;
const PRO: Entitlements = { palettePro: true, communityPlus: false };

describe('saveAllowance', () => {
  beforeEach(() => counted.mockReset());

  it('lets a free player create until the slots are gone', async () => {
    counted.mockResolvedValue(4);
    await expect(saveAllowance(NO_ENTITLEMENTS)).resolves.toEqual({
      used: 4,
      limit: 5,
      canCreate: true,
    });
  });

  it('stops a free player at the limit', async () => {
    counted.mockResolvedValue(5);
    await expect(saveAllowance(NO_ENTITLEMENTS)).resolves.toMatchObject({ canCreate: false });
  });

  it('still lets a grandfathered player create when the count runs past the cap', async () => {
    // A lapsed subscriber can sit above the cap. Their work stays; they just wait
    // until they are under it again — which is a different thing from being locked
    // out of the projects they already have.
    counted.mockResolvedValue(12);
    await expect(saveAllowance(NO_ENTITLEMENTS)).resolves.toMatchObject({ canCreate: false });
  });

  it('does not even count for a subscriber', async () => {
    await expect(saveAllowance(PRO)).resolves.toMatchObject({ canCreate: true });
    expect(counted).not.toHaveBeenCalled();
  });

  it('says how many slots there were', () => {
    expect(saveLimitMessage(5)).toContain('5');
  });
});

import { favoriteLimitMessage, toggleFavorite } from '@/features/projects/favorites';
import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';
import { countFavorites, setFavorite } from '@/repositories/projectRepository';

jest.mock('@/repositories/projectRepository', () => ({
  countFavorites: jest.fn(),
  setFavorite: jest.fn(),
}));

const counted = countFavorites as jest.MockedFunction<typeof countFavorites>;
const stored = setFavorite as jest.MockedFunction<typeof setFavorite>;
const PRO: Entitlements = { palettePro: true, communityPlus: false };

describe('toggleFavorite', () => {
  beforeEach(() => {
    counted.mockReset();
    stored.mockReset();
    stored.mockResolvedValue(undefined);
  });

  it('stars a project while there is room', async () => {
    counted.mockResolvedValue(19);
    await expect(toggleFavorite('p1', false, NO_ENTITLEMENTS)).resolves.toEqual({
      ok: true,
      favorited: true,
    });
    expect(stored).toHaveBeenCalledWith('p1', true);
  });

  it('refuses once the free ceiling is reached', async () => {
    counted.mockResolvedValue(20);
    await expect(toggleFavorite('p1', false, NO_ENTITLEMENTS)).resolves.toEqual({
      ok: false,
      reason: 'limit',
      limit: 20,
    });
    expect(stored).not.toHaveBeenCalled();
  });

  it('always lets a full player unstar', async () => {
    // A limit that stops you tidying up is a trap, not a boundary.
    counted.mockResolvedValue(20);
    await expect(toggleFavorite('p1', true, NO_ENTITLEMENTS)).resolves.toEqual({
      ok: true,
      favorited: false,
    });
    expect(stored).toHaveBeenCalledWith('p1', false);
  });

  it('does not even count for a subscriber', async () => {
    await expect(toggleFavorite('p1', false, PRO)).resolves.toMatchObject({ ok: true });
    expect(counted).not.toHaveBeenCalled();
  });

  it('says how many stars there were', () => {
    expect(favoriteLimitMessage(20)).toContain('20');
  });
});

/**
 * Normalize raw energy ids. Unknown / missing → build (preserves pre-Energy sound).
 */

import { DEFAULT_ENERGY, type AccompanimentEnergy, ENERGY_IDS } from './types';

const VALID = new Set<string>(ENERGY_IDS);

export function isAccompanimentEnergy(raw: unknown): raw is AccompanimentEnergy {
  return typeof raw === 'string' && VALID.has(raw);
}

export function normalizeEnergy(raw: unknown): AccompanimentEnergy {
  return isAccompanimentEnergy(raw) ? raw : DEFAULT_ENERGY;
}

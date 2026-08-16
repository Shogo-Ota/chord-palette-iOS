/**
 * Apply a Style×Energy profile to a resolved style skeleton + variation.
 * Role-specific — never a single multiplier on every event.
 */

import type { BassProfile } from '../bass/types';
import type { StylePreset, StepPattern, VelocitySpec } from '../styles/types';
import type { VariationProfile } from '../variation/types';

import type { EnergyProfile } from './types';

const EPSILON = 1e-9;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function clonePattern(p: StepPattern): StepPattern {
  return {
    hits: [...p.hits],
    accent: [...p.accent],
    ...(p.ghost ? { ghost: [...p.ghost] } : {}),
  };
}

/**
 * Density < 1: drop weakest accents first (keep bar heads).
 * Density > 1: raise accents / optionally revive near-miss silent steps with low accent.
 */
function reshapeHits(pattern: StepPattern, density: number, attack: number): StepPattern {
  const out = clonePattern(pattern);
  const n = out.hits.length;
  if (n === 0) return out;

  if (density < 1 - EPSILON) {
    const active: { i: number; accent: number }[] = [];
    for (let i = 0; i < n; i++) {
      if (!out.hits[i]) continue;
      // Protect step 0 (downbeat) and the strongest accent.
      if (i === 0) continue;
      active.push({ i, accent: out.accent[i] ?? 0.5 });
    }
    active.sort((a, b) => a.accent - b.accent);
    const dropTarget = Math.floor(active.length * (1 - density));
    for (let k = 0; k < dropTarget; k++) {
      out.hits[active[k].i] = false;
    }
  } else if (density > 1 + EPSILON) {
    // Prefer reinforcing existing hits over inventing a machine-gun grid.
    for (let i = 0; i < n; i++) {
      if (out.hits[i]) {
        out.accent[i] = clamp01((out.accent[i] ?? 0.5) * (0.85 + 0.15 * density));
      }
    }
    // Lightly revive the highest-accent silent step once (musical fill-in, not +20%).
    let best = -1;
    let bestA = -1;
    for (let i = 1; i < n; i++) {
      if (out.hits[i]) continue;
      const a = out.accent[i] ?? 0.4;
      if (a > bestA) {
        bestA = a;
        best = i;
      }
    }
    if (best >= 0 && density >= 1.1) {
      out.hits[best] = true;
      out.accent[best] = clamp01(Math.max(0.55, bestA));
    }
  }

  if (Math.abs(attack - 1) > EPSILON) {
    for (let i = 0; i < n; i++) {
      if (!out.hits[i]) continue;
      out.accent[i] = clamp01(0.5 + ((out.accent[i] ?? 0.5) - 0.5) * attack);
    }
  }
  return out;
}

function scaleDrumHits(pattern: StepPattern, scale: number, emphasizeBackbeat: boolean): StepPattern {
  const out = clonePattern(pattern);
  if (Math.abs(scale - 1) < EPSILON && !emphasizeBackbeat) return out;
  const n = out.hits.length;
  for (let i = 0; i < n; i++) {
    if (!out.hits[i]) continue;
    if (scale < 1) {
      // Thin ghosts / weak hats first.
      const a = out.accent[i] ?? 0.5;
      const isGhost = out.ghost?.[i];
      if ((isGhost || a < 0.55) && a < 1.15 - scale) {
        out.hits[i] = false;
      } else {
        out.accent[i] = clamp01(a * (0.7 + 0.3 * scale));
      }
    } else {
      out.accent[i] = clamp01((out.accent[i] ?? 0.5) * (0.9 + 0.1 * scale));
    }
  }
  if (emphasizeBackbeat && n >= 8) {
    // Steps at beat 2 and 4 on an 8th grid (2, 6) or 16th (4, 12).
    const backbeats = n === 16 ? [4, 12] : n === 8 ? [2, 6] : [];
    for (const i of backbeats) {
      if (out.hits[i]) out.accent[i] = clamp01((out.accent[i] ?? 0.8) * 1.08);
    }
  }
  return out;
}

function scaleVelocity(v: VelocitySpec, profile: EnergyProfile): VelocitySpec {
  const chord = clamp(v.center.chord + profile.velocityDelta, 1, 127);
  const bassDelta =
    profile.bassActivityScale >= 1
      ? Math.round((profile.bassActivityScale - 1) * 8)
      : Math.round((profile.bassActivityScale - 1) * 10);
  const drumDelta =
    profile.drumActivityScale >= 1
      ? Math.round((profile.drumActivityScale - 1) * 6)
      : Math.round((profile.drumActivityScale - 1) * 8);
  const baseTop = v.topEmphasis ?? 3;
  return {
    ...v,
    center: {
      chord,
      bass: clamp(v.center.bass + bassDelta, 1, 127),
      kick: clamp(v.center.kick + drumDelta, 1, 127),
      snare: clamp(v.center.snare + Math.round(drumDelta * 1.2), 1, 127),
      hat: clamp(v.center.hat + Math.round(drumDelta * 0.6), 1, 127),
    },
    accentDepth: clamp(v.accentDepth + profile.voicingWidthDelta * 2 + (profile.attackDensity - 1) * 8, 8, 56),
    phraseDepth: clamp(v.phraseDepth * profile.phraseVariationScale, 2, 16),
    topEmphasis: clamp(baseTop * profile.topNoteEmphasisScale + profile.polyphonyDelta, 0, 10),
  };
}

function scaleGate(style: StylePreset, gateScale: number): StylePreset['gate'] {
  if (Math.abs(gateScale - 1) < EPSILON) return style.gate;
  return {
    ...style.gate,
    min: clamp(style.gate.min * gateScale, 0.45, 0.98),
    max: clamp(style.gate.max * gateScale, 0.5, 0.99),
  };
}

function scaleVariation(
  variation: VariationProfile | undefined,
  profile: EnergyProfile,
): VariationProfile | undefined {
  if (!variation) return variation;
  const restP = clamp01(variation.rests.probability * profile.restRatioScale);
  const bassOnlyP = clamp01(variation.bassOnly.probability * profile.restRatioScale);
  const twoFourP = clamp01(variation.twoFourBar.probability * profile.phraseVariationScale);
  let extraStab = clamp01(variation.phraseFill.extraStabProbability * profile.phraseVariationScale);
  let sustainFinal = variation.phraseFill.sustainFinal;
  if (profile.phraseEnd === 'space') {
    sustainFinal = true;
    extraStab = clamp01(extraStab * 0.6);
  } else if (profile.phraseEnd === 'push') {
    sustainFinal = false;
    extraStab = clamp01(Math.max(extraStab, 0.35) * 1.15);
  }
  // syncopationScale nudges ties (held off-beats) without a global event multiplier.
  const tieP = clamp01(variation.ties.probability * profile.syncopationScale);
  return {
    rests: { ...variation.rests, probability: restP },
    ties: { ...variation.ties, probability: tieP },
    twoFourBar: { ...variation.twoFourBar, probability: twoFourP },
    phraseFill: { sustainFinal, extraStabProbability: extraStab },
    bassOnly: { ...variation.bassOnly, probability: bassOnlyP },
  };
}

export interface EnergyApplication {
  style: StylePreset;
  variation?: VariationProfile;
  /** Semitones for chord + top pitches only. */
  registerOffsetSemitones: number;
  /** Merged into bass planner approach chance. */
  bassApproachProbability?: number;
  /** Hint for Band chorus open-hat / fill (native drums may ignore until wired). */
  fillProbability?: number;
  openHatProbability?: number;
}

/**
 * Bend a resolved plan by Style×Energy. build/IDENTITY leaves musical content intact.
 */
export function applyEnergyProfile(
  style: StylePreset,
  variation: VariationProfile | undefined,
  profile: EnergyProfile,
): EnergyApplication {
  // Exact short-circuit so migration default (build) cannot drift velocity keys etc.
  if (isIdentityProfile(profile)) {
    return {
      style,
      variation,
      registerOffsetSemitones: 0,
      bassApproachProbability: profile.bassApproachProbability,
      fillProbability: profile.fillProbability,
      openHatProbability: profile.openHatProbability,
    };
  }

  const emphasizeBackbeat = profile.attackDensity > 1.15 && profile.drumActivityScale > 1.1;
  const next: StylePreset = {
    ...style,
    chord: reshapeHits(style.chord, profile.noteDensity, profile.attackDensity),
    bass: reshapeHits(style.bass, profile.bassActivityScale, 1),
    kick: scaleDrumHits(style.kick, Math.sqrt(profile.drumActivityScale), false),
    snare: scaleDrumHits(style.snare, profile.drumActivityScale, emphasizeBackbeat),
    hat: scaleDrumHits(style.hat, profile.drumActivityScale, false),
    velocity: scaleVelocity(style.velocity, profile),
    gate: scaleGate(style, profile.gateScale),
  };
  if (style.top) {
    next.top = reshapeHits(style.top, profile.noteDensity, profile.attackDensity);
  }
  return {
    style: next,
    variation: scaleVariation(variation, profile),
    registerOffsetSemitones: profile.registerOffset,
    bassApproachProbability: profile.bassApproachProbability,
    fillProbability: profile.fillProbability,
    openHatProbability: profile.openHatProbability,
  };
}

function isIdentityProfile(p: EnergyProfile): boolean {
  return (
    p.noteDensity === 1 &&
    p.attackDensity === 1 &&
    p.velocityDelta === 0 &&
    p.registerOffset === 0 &&
    p.voicingWidthDelta === 0 &&
    p.polyphonyDelta === 0 &&
    p.gateScale === 1 &&
    p.restRatioScale === 1 &&
    p.syncopationScale === 1 &&
    p.phraseVariationScale === 1 &&
    p.bassActivityScale === 1 &&
    p.drumActivityScale === 1 &&
    p.topNoteEmphasisScale === 1 &&
    (p.phraseEnd === undefined || p.phraseEnd === 'neutral')
  );
}

/** Merge Energy approach hint into a bass movement profile. */
export function bassProfileWithEnergy(
  base: BassProfile,
  approachProbability: number | undefined,
): BassProfile {
  if (approachProbability === undefined) return base;
  return {
    ...base,
    approachChance: clamp01(approachProbability),
  };
}

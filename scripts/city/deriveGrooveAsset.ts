import type { CitySourceForensic } from './sourceForensic';

export type ExtractedCityGrooveAsset = {
  schemaVersion: 1;
  id: 'city.type1.source-derived.v1';
  sourceEvidence: {
    sha256: string;
    ppq: number;
    measuredBars: number;
    measuredAttackGroups: number;
  };
  cycleBeats: 4;
  attacksPerCycle: 6;
  attacks: {
    index: number;
    onsetBeat: number;
    durationBeat: number;
    gapToNextAttackBeat: number;
    relativeVelocity: number;
    accent: 'STRONG' | 'WEAK';
    sourceMaskEvidence: 'FULL';
  }[];
  handChordRoll: {
    observed: boolean;
    enabledByDefault: false;
    direction: 'ASCENDING';
    offsetsBeatByAscendingPitchRank: number[];
    measuredSpreadBeat: number;
  };
  pedal: {
    cc64Present: false;
  };
  abstraction: {
    sourceGridOffsetBeat: number;
    cycleRule: string;
    velocityRule: string;
    harmonyExcluded: true;
    literalPitchExcluded: true;
  };
};

function rounded(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = (sorted.length - 1) / 2;
  const lo = Math.floor(middle);
  const hi = Math.ceil(middle);
  return sorted.length === 0 ? 0 : sorted[lo]! * (hi - middle) + sorted[hi]! * (middle - lo);
}

export function deriveCityGrooveAsset(report: CitySourceForensic): ExtractedCityGrooveAsset {
  const firstPattern = report.phrase.barPatterns[0];
  if (!firstPattern || firstPattern.attackCount !== 6) {
    throw new Error('City Type1 extraction requires the measured six-attack bar');
  }
  if (
    report.phrase.barPatterns.some(
      (pattern) => pattern.onsetSignature !== firstPattern.onsetSignature,
    )
  ) {
    throw new Error('City Type1 onset pattern is not stable across measured bars');
  }

  const slotGroups = Array.from({ length: 6 }, (_, slot) =>
    report.attacks.groups.filter((_, index) => index % 6 === slot),
  );
  const rawVelocity = slotGroups.map((groups) =>
    median(groups.map((group) => group.normalizedVelocity)),
  );
  const velocityMean = rawVelocity.reduce((sum, value) => sum + value, 0) / rawVelocity.length;
  const roll = report.attacks.rollPatternCounts[0];
  if (!roll || roll.direction !== 'ASCENDING' || roll.count !== report.attacks.count) {
    throw new Error('City Type1 extraction requires one stable ascending roll pattern');
  }
  const rollOffsetsBeat = roll.relativeOnsetTicksByAscendingPitch.map((ticks) =>
    rounded(ticks / report.file.ppq),
  );
  const measuredSpreadBeat = rollOffsetsBeat[rollOffsetsBeat.length - 1]! - rollOffsetsBeat[0]!;

  const attacks = slotGroups.map((groups, index) => {
    const onsetBeat = median(groups.map((group) => group.beatInBar));
    const durationBeat = median(groups.map((group) => group.durationMedianBeats));
    const nextOnset =
      index + 1 < slotGroups.length
        ? median(slotGroups[index + 1]!.map((group) => group.beatInBar))
        : median(slotGroups[0]!.map((group) => group.beatInBar)) + 4;
    const gapToNextAttackBeat = nextOnset - (onsetBeat + durationBeat + measuredSpreadBeat);
    const relativeVelocity = rawVelocity[index]! / velocityMean;
    return {
      index,
      onsetBeat: rounded(onsetBeat),
      durationBeat: rounded(durationBeat),
      gapToNextAttackBeat: rounded(gapToNextAttackBeat),
      relativeVelocity: rounded(relativeVelocity, 4),
      accent: relativeVelocity < 0.85 ? ('WEAK' as const) : ('STRONG' as const),
      // Source polyphony is exactly three at every attack. No evidence supports
      // source-driven note subtraction, so FULL is the neutral extracted hint.
      sourceMaskEvidence: 'FULL' as const,
    };
  });

  return {
    schemaVersion: 1,
    id: 'city.type1.source-derived.v1',
    sourceEvidence: {
      sha256: report.source.sha256,
      ppq: report.file.ppq,
      measuredBars: report.file.barCount,
      measuredAttackGroups: report.attacks.count,
    },
    cycleBeats: 4,
    attacksPerCycle: 6,
    attacks,
    handChordRoll: {
      observed: true,
      enabledByDefault: false,
      direction: 'ASCENDING',
      offsetsBeatByAscendingPitchRank: rollOffsetsBeat,
      measuredSpreadBeat: rounded(measuredSpreadBeat),
    },
    pedal: {
      cc64Present: false,
    },
    abstraction: {
      sourceGridOffsetBeat: rounded(
        median(report.attacks.groups.map((group) => group.nearestSixteenthDeviationBeats)),
      ),
      cycleRule:
        'The identical measured onset signature repeats in all four occupied bars; City Type1 stores one reusable four-beat cycle.',
      velocityRule:
        'Median normalized velocity per repeated attack slot, then renormalized to cycle mean 1.0.',
      harmonyExcluded: true,
      literalPitchExcluded: true,
    },
  };
}

export function renderExtractedCityGrooveMarkdown(asset: ExtractedCityGrooveAsset): string {
  const lines: string[] = [
    '# City Type1 — Normalized Groove Asset',
    '',
    `ID: \`${asset.id}\``,
    `Source evidence SHA-256: \`${asset.sourceEvidence.sha256}\``,
    '',
    '## Generalization',
    '',
    `- Cycle: **${asset.cycleBeats} beats**`,
    `- Attacks per cycle: **${asset.attacksPerCycle}**`,
    `- Measured evidence: **${asset.sourceEvidence.measuredBars} bars / ${asset.sourceEvidence.measuredAttackGroups} attacks**`,
    `- Source-wide grid offset: **${asset.abstraction.sourceGridOffsetBeat} beats**`,
    `- CC64: **${asset.pedal.cc64Present ? 'present' : 'absent'}**`,
    '',
    '## Reusable attacks',
    '',
    ...asset.attacks.map(
      (attack) =>
        `- ${attack.index + 1}: onset=${attack.onsetBeat}, duration=${attack.durationBeat}, gap=${attack.gapToNextAttackBeat}, velocity=${attack.relativeVelocity}, accent=${attack.accent}, sourceMask=${attack.sourceMaskEvidence}`,
    ),
    '',
    '## Optional hand chord roll',
    '',
    `- Observed: **${asset.handChordRoll.observed}**`,
    `- Default: **${asset.handChordRoll.enabledByDefault ? 'enabled' : 'disabled pending listening'}**`,
    `- Direction: **${asset.handChordRoll.direction}**`,
    `- Ascending pitch-rank offsets: \`${asset.handChordRoll.offsetsBeatByAscendingPitchRank.join(', ')} beats\``,
    `- Spread: **${asset.handChordRoll.measuredSpreadBeat} beats**`,
    '',
    '## Intentional abstraction',
    '',
    `- ${asset.abstraction.cycleRule}`,
    `- ${asset.abstraction.velocityRule}`,
    '- Source pitch, chord progression, melody and source harmony are absent.',
    '- Source polyphony was constant at three notes, so the extracted mask hint is FULL at every attack.',
    '- FULL/Triad/Shell subtraction is a separate Chord Palette listening candidate, not claimed as source evidence.',
    '- The measured roll is stored but disabled by default until simultaneous vs roll listening comparison.',
    '',
  ];
  return lines.join('\n');
}

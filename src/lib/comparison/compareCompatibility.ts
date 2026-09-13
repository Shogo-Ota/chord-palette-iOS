import type {
  CompareCompatibility,
  CompareUnsupportedReason,
  CreationSnapshotV1,
} from './contracts';
import { semanticHarmonyDiff } from './semanticHarmonyDiff';

function unsupported(reason: CompareUnsupportedReason): CompareCompatibility {
  return Object.freeze({ supported: false, reason });
}

function totalBeats(snapshot: CreationSnapshotV1): number {
  return snapshot.progression.reduce((sum, event) => sum + event.durationBeats, 0);
}

function sameAudioSettings(base: CreationSnapshotV1, variant: CreationSnapshotV1): boolean {
  return (
    base.grooveId === variant.grooveId &&
    base.accompanimentPattern === variant.accompanimentPattern &&
    base.accompanimentVariant === variant.accompanimentVariant &&
    base.accompanimentEnergy === variant.accompanimentEnergy &&
    base.instrumentId === variant.instrumentId &&
    base.instrumentEffect === variant.instrumentEffect &&
    base.releaseCut === variant.releaseCut &&
    base.octaveShift === variant.octaveShift &&
    base.drumMode === variant.drumMode &&
    base.drumBeat === variant.drumBeat
  );
}

function hasUnsupportedEventDifference(
  base: CreationSnapshotV1,
  variant: CreationSnapshotV1,
): boolean {
  return base.progression.some((event, index) => {
    const next = variant.progression[index];
    return next == null || event.voicingPosition !== next.voicingPosition;
  });
}

export function compareCompatibility(
  base: CreationSnapshotV1 | null,
  variant: CreationSnapshotV1,
): CompareCompatibility {
  if (!base) return unsupported('MISSING_BASE');
  if (base.sourceProjectId !== variant.sourceProjectId) {
    return unsupported('SOURCE_PROJECT_MISMATCH');
  }
  if (base.bpm !== variant.bpm) return unsupported('TEMPO_MISMATCH');
  if (base.beatsPerBar !== variant.beatsPerBar) return unsupported('METER_MISMATCH');
  if (base.key !== variant.key || base.mode !== variant.mode) {
    return unsupported('KEY_MISMATCH');
  }
  if (!sameAudioSettings(base, variant)) {
    return unsupported('AUDIO_SETTING_MISMATCH');
  }

  const baseBeats = totalBeats(base);
  const variantBeats = totalBeats(variant);
  if (baseBeats !== variantBeats) return unsupported('DURATION_MISMATCH');
  if (base.progression.length !== variant.progression.length) {
    return unsupported('INSERTION_NOT_V1');
  }
  if (base.progression.some((event, index) => event.id !== variant.progression[index]?.id)) {
    return unsupported('UNSUPPORTED_EVENT');
  }

  const changes = semanticHarmonyDiff(base, variant);
  const audibleChanges = changes.filter((change) => change.kind !== 'notation-only');
  if (audibleChanges.length === 0) return unsupported('IDENTICAL');
  if (hasUnsupportedEventDifference(base, variant)) {
    return unsupported('UNSUPPORTED_EVENT');
  }
  if (
    audibleChanges.some(
      (change) =>
        change.changedFields.includes('duration') || change.baseIndex !== change.variantIndex,
    )
  ) {
    return unsupported('DURATION_MISMATCH');
  }

  return Object.freeze({
    supported: true,
    alignment: 'one-to-one',
    totalBeats: baseBeats,
    changes,
    copyKey: audibleChanges.length === 1 ? 'single-change' : 'multi-change',
  });
}

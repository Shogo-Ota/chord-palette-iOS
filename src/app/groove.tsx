import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { DrumBeatSegment } from '@/components/DrumBeatSegment';
import { DrumModeSegment } from '@/components/DrumModeSegment';
import { Chip, ChipRow, SectionTitle, VolumeSlider } from '@/components/controls';
import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import {
  ACCOMPANIMENT_HINTS,
  ACCOMPANIMENT_LABELS,
  ENABLED_INSTRUMENTS,
  INSTRUMENT_LABELS,
} from '@/data/labels';
import * as session from '@/features/editor/session';
import { useEditorSession } from '@/features/editor/session';
import { useLiveSoundReapply } from '@/features/editor/useLiveSoundReapply';
import type { DrumBeat } from '@/lib/drum/drumBeat';
import { drumBeatSelectorVisible, type DrumMode } from '@/lib/drum/drumMode';
import { logger } from '@/lib/logger';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { defaultVariantFor, offeredVariantsFor } from '@/lib/performance/variants';
import { setDrumBeatPref, setDrumModePref } from '@/repositories/sessionPrefsRepository';
import { audioService } from '@/services/audio';
import {
  VOLUME_DEFAULTS,
  type PlaybackState,
  type VolumeChannel,
  type VolumeLevels,
} from '@/services/audio/types';
import { percentToVolume, volumeToPercent } from '@/lib/volume';
import { colors, font, radius } from '@/theme/tokens';
import type { ChordFunction, InstrumentId } from '@/types';

const FUNC_COLORS: Record<ChordFunction, { color: string; text: string }> = {
  tonic: { color: colors.tonic, text: colors.tonicText },
  subdominant: { color: colors.subdominant, text: colors.subdominantText },
  dominant: { color: colors.dominant, text: colors.dominantText },
};

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function GrooveScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const grooveChipW = (width - 40 - 8) / 2;
  const s = useEditorSession();
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const drumOff = s.drumMode === 'off';
  const showDrumBeat = drumBeatSelectorVisible(s.drumMode);
  // Types are the real teacher takes this pattern owns — never padded to a fixed count.
  const patternTypes = offeredVariantsFor(s.accompanimentPattern);
  const activeType = patternTypes.find((v) => v.id === s.accompanimentVariant);
  const typeChipW = (width - 40 - 8 * 2) / 3;

  const [volumes, setVolumes] = useState<VolumeLevels>(
    () => audioService.getVolumes() ?? VOLUME_DEFAULTS,
  );

  useEffect(() => {
    audioService.prepare().catch((e) => logger.error('Audio prepare failed', { error: String(e) }));
    setPlaybackState(audioService.getState());
    const sub = audioService.addStateListener((e) => setPlaybackState(e.state));
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = audioService.getVolumes();
    if (cached) {
      setVolumes(cached);
      return;
    }
    audioService
      .restoreVolumes()
      .then((levels) => {
        if (!cancelled) setVolumes(levels);
      })
      .catch((e) => logger.error('Volume restore failed', { error: String(e) }));
    return () => {
      cancelled = true;
    };
  }, []);

  const volThrottle = useRef<
    Partial<Record<VolumeChannel, { last: number; timer: ReturnType<typeof setTimeout> | null }>>
  >({});

  useEffect(
    () => () => {
      (['master', 'chord', 'drum'] as VolumeChannel[]).forEach((ch) => {
        const t = volThrottle.current[ch];
        if (t?.timer) {
          clearTimeout(t.timer);
          t.timer = null;
        }
      });
      const cached = audioService.getVolumes();
      if (cached) {
        void audioService.setVolume('chord', cached.chord).catch(() => undefined);
        void audioService.setVolume('drum', cached.drum).catch(() => undefined);
      }
    },
    [],
  );

  function persistVolume(channel: VolumeChannel, value: number) {
    audioService
      .setVolume(channel, value)
      .catch((e) => logger.error('Volume set failed', { channel, error: String(e) }));
  }

  function handleVolumeChange(channel: VolumeChannel, percent: number) {
    const value = percentToVolume(percent);
    setVolumes((prev) => ({ ...prev, [channel]: value }));
    audioService.setVolumeLive(channel, value);

    const THROTTLE_MS = 60;
    const now = Date.now();
    const entry = volThrottle.current[channel] ?? { last: 0, timer: null };
    volThrottle.current[channel] = entry;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    const elapsed = now - entry.last;
    if (elapsed >= THROTTLE_MS || value === 0 || value === 1) {
      entry.last = now;
      persistVolume(channel, value);
    } else {
      entry.timer = setTimeout(() => {
        entry.last = Date.now();
        entry.timer = null;
        persistVolume(channel, value);
      }, THROTTLE_MS - elapsed);
    }
  }

  function handleDrumModeChange(mode: DrumMode) {
    session.setDrumMode(mode);
    audioService.setDrumMuted(mode === 'off');
    setDrumModePref(mode).catch((e) =>
      logger.error('Drum-mode persist failed', { error: String(e) }),
    );
  }

  function handleDrumBeatChange(beat: DrumBeat) {
    session.setDrumBeat(beat);
    setDrumBeatPref(beat).catch((e) =>
      logger.error('Drum-beat persist failed', { error: String(e) }),
    );
  }

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  useLiveSoundReapply(playbackState, true, s);

  function handlePatternChange(id: (typeof PUBLIC_ACCOMPANIMENT_PATTERNS)[number]) {
    session.setAccompaniment(id, defaultVariantFor(id).id);
  }

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={handleBack} hitSlop={8}>
          <Icon name="chevronLeft" size={17} color={colors.textSecondary} strokeWidth={2.4} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>伴奏設定</Text>
        </View>
      </View>

      <View style={styles.progPanel}>
        <Text style={styles.progLabel}>現在のコード進行</Text>
        {s.progression.length === 0 ? (
          <Text style={styles.progEmpty}>まだコードがありません</Text>
        ) : (
          <View style={styles.progRow}>
            {s.progression.slice(0, 6).map((c, i, arr) => {
              const fc = FUNC_COLORS[c.function];
              return (
                <React.Fragment key={c.id}>
                  <View
                    style={[
                      styles.progChip,
                      { backgroundColor: rgba(fc.color, 0.12), borderColor: rgba(fc.color, 0.3) },
                    ]}>
                    <Text style={[styles.progChipText, { color: fc.text }]} numberOfLines={1}>
                      {c.displayName}
                    </Text>
                  </View>
                  {i < arr.length - 1 && <Text style={styles.progArrow}>→</Text>}
                </React.Fragment>
              );
            })}
          </View>
        )}
      </View>

      <SectionTitle>伴奏パターン</SectionTitle>
      <View style={styles.grid}>
        {PUBLIC_ACCOMPANIMENT_PATTERNS.map((id) => (
          <Chip
            key={id}
            label={ACCOMPANIMENT_LABELS[id]}
            active={id === s.accompanimentPattern}
            onPress={() => handlePatternChange(id)}
            style={{ width: grooveChipW }}
            textStyle={{ fontSize: 13 }}
          />
        ))}
      </View>
      {patternTypes.length > 1 && (
        <View style={styles.typeRow}>
          {patternTypes.map((v) => (
            <Chip
              key={v.id}
              label={v.label}
              active={v.id === s.accompanimentVariant}
              onPress={() => session.setAccompanimentVariant(v.id)}
              style={{ width: typeChipW }}
              textStyle={{ fontSize: 12 }}
            />
          ))}
        </View>
      )}
      <Text style={styles.patternHint} numberOfLines={2}>
        {activeType?.hint ?? ACCOMPANIMENT_HINTS[s.accompanimentPattern]}
      </Text>

      <SectionTitle>音色</SectionTitle>
      <ChipRow
        options={ENABLED_INSTRUMENTS.map((id) => ({ key: id, label: INSTRUMENT_LABELS[id] }))}
        value={s.instrumentId}
        onChange={(k) => session.setInstrument(k as InstrumentId)}
        chipStyle={{ paddingVertical: 12 }}
      />

      <SectionTitle>ドラム</SectionTitle>
      <DrumModeSegment value={s.drumMode} onChange={handleDrumModeChange} />
      {showDrumBeat && <DrumBeatSegment value={s.drumBeat} onChange={handleDrumBeatChange} />}
      {!drumOff && (
        <View style={styles.volPanel}>
          <VolumeSlider
            label="ドラム音量"
            percent={volumeToPercent(volumes.drum)}
            onChange={(p) => handleVolumeChange('drum', p)}
          />
        </View>
      )}
      {drumOff && <View style={styles.drumSpacer} />}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingBottom: 16,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontFamily: font.extrabold, fontWeight: '800', color: colors.textPrimary },

  progPanel: {
    backgroundColor: colors.surfacePanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius['2xl'],
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 14,
  },
  progLabel: {
    fontSize: 10.5,
    color: colors.textFaint,
    fontFamily: font.semibold,
    fontWeight: '600',
    marginBottom: 8,
  },
  progEmpty: { fontSize: 12.5, color: colors.textDim },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 7,
    alignItems: 'center',
  },
  progChipText: { fontSize: 12.5, fontFamily: font.bold, fontWeight: '700' },
  progArrow: { color: colors.textFaintest },

  sectionGap: { marginBottom: 20 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  patternHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textFaint,
    fontFamily: font.regular,
    marginTop: 10,
    marginBottom: 20,
    marginHorizontal: 2,
  },

  volPanel: {
    backgroundColor: colors.surfacePanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xl,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginBottom: 22,
    gap: 13,
  },
  drumSpacer: { height: 22 },
});

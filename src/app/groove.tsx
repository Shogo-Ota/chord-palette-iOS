import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Chip, ChipRow, SectionTitle, VolumeSlider } from '@/components/controls';
import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import {
  ACCOMPANIMENT_IDS,
  ACCOMPANIMENT_LABELS,
  ENABLED_INSTRUMENTS,
  GROOVE_IDS,
  GROOVE_LABELS,
  INSTRUMENT_LABELS,
} from '@/data/labels';
import { sessionToPlaybackRequest } from '@/features/editor/playback';
import * as session from '@/features/editor/session';
import { getSession, useEditorSession } from '@/features/editor/session';
import { logger } from '@/lib/logger';
import { percentToVolume, volumeToPercent } from '@/lib/volume';
import { audioService } from '@/services/audio';
import {
  VOLUME_DEFAULTS,
  type PlaybackState,
  type VolumeChannel,
  type VolumeLevels,
} from '@/services/audio/types';
import { colors, font, primaryGradient, radius } from '@/theme/tokens';
import type { AccompanimentPattern, ChordFunction, InstrumentId } from '@/types';

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
  const chipW = (width - 40 - 16) / 3; // 3-col grid, 20 padH, 8 gap
  const s = useEditorSession();
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const playing = playbackState === 'playing';

  // Live channel volumes for the sliders. Seeded from the cached/persisted
  // levels so the UI reflects reality; the canonical store stays SQLite.
  const [volumes, setVolumes] = useState<VolumeLevels>(
    () => audioService.getVolumes() ?? VOLUME_DEFAULTS,
  );

  // Share the editor's audio engine. It is prepared by the editor (this screen is
  // pushed on top), but prepare() is idempotent so we call it defensively. We do
  // NOT tear down here — that stays with the editor which owns the lifecycle.
  useEffect(() => {
    audioService.prepare().catch((e) => logger.error('Audio prepare failed', { error: String(e) }));
    const sub = audioService.addStateListener((e) => setPlaybackState(e.state));
    return () => sub?.remove();
  }, []);

  // Load current volumes on mount: prefer the in-memory cache, otherwise restore
  // from SQLite (which also re-applies them to the native engine).
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

  // Throttle native/SQLite writes per channel (~60ms) with a trailing flush, so
  // dragging stays smooth without spamming persistence. UI state updates every
  // frame so the knob tracks the finger.
  const volThrottle = useRef<
    Partial<Record<VolumeChannel, { last: number; timer: ReturnType<typeof setTimeout> | null }>>
  >({});

  useEffect(
    () => () => {
      Object.values(volThrottle.current).forEach((t) => {
        if (t?.timer) clearTimeout(t.timer);
      });
    },
    [],
  );

  function commitVolume(channel: VolumeChannel, value: number) {
    audioService
      .setVolume(channel, value)
      .catch((e) => logger.error('Volume set failed', { channel, error: String(e) }));
  }

  function handleVolumeChange(channel: VolumeChannel, percent: number) {
    const value = percentToVolume(percent);
    setVolumes((prev) => ({ ...prev, [channel]: value }));

    const THROTTLE_MS = 60;
    const now = Date.now();
    const entry = volThrottle.current[channel] ?? { last: 0, timer: null };
    volThrottle.current[channel] = entry;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    const elapsed = now - entry.last;
    if (elapsed >= THROTTLE_MS) {
      entry.last = now;
      commitVolume(channel, value);
    } else {
      entry.timer = setTimeout(() => {
        entry.last = Date.now();
        entry.timer = null;
        commitVolume(channel, value);
      }, THROTTLE_MS - elapsed);
    }
  }

  function togglePlayback() {
    const cur = getSession();
    if (playing) {
      audioService.pause().catch((e) => logger.error('Audio pause failed', { error: String(e) }));
      return;
    }
    if (playbackState === 'paused') {
      audioService.resume().catch((e) => logger.error('Audio resume failed', { error: String(e) }));
      return;
    }
    if (cur.progression.length === 0) return;
    audioService
      .play(sessionToPlaybackRequest(cur, true))
      .catch((e) => logger.error('Audio play failed', { error: String(e) }));
  }

  // NOTE: live re-apply of instrument/groove/accompaniment is owned by the editor
  // screen (which stays mounted underneath this one), so changing a setting here
  // rebuilds playback exactly once. Duplicating it here would double-trigger play().

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevronLeft" size={17} color={colors.textSecondary} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>再生 & グルーヴ</Text>
      </View>

      {/* current progression */}
      <View style={styles.progPanel}>
        <Text style={styles.progLabel}>現在の進行</Text>
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

      {/* big play */}
      <View style={styles.playPanel}>
        <Icon name="skipBack" size={22} color={colors.textMuted} strokeWidth={2.2} />
        <Pressable onPress={togglePlayback} disabled={s.progression.length === 0}>
          <LinearGradient
            colors={primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.bigPlay,
              playing && styles.bigPlayActive,
              s.progression.length === 0 && styles.bigPlayDisabled,
            ]}>
            <Icon name={playing ? 'pause' : 'play'} size={27} color="#fff" />
          </LinearGradient>
        </Pressable>
        <Icon name="skipForward" size={22} color={colors.textMuted} strokeWidth={2.2} />
      </View>

      {/* 音色（現在は Piano / E.Piano のみ有効。追加は labels.ts の ENABLED_INSTRUMENTS） */}
      <SectionTitle>音色</SectionTitle>
      <ChipRow
        options={ENABLED_INSTRUMENTS.map((id) => ({ key: id, label: INSTRUMENT_LABELS[id] }))}
        value={s.instrumentId}
        onChange={(k) => session.setInstrument(k as InstrumentId)}
        style={{ marginBottom: 20 }}
        chipStyle={{ paddingVertical: 12 }}
      />

      {/* ドラムグルーヴ */}
      <SectionTitle>ドラムグルーヴ</SectionTitle>
      <View style={styles.grid}>
        {GROOVE_IDS.map((id) => (
          <Chip
            key={id}
            label={GROOVE_LABELS[id]}
            active={id === s.grooveId}
            onPress={() => session.setGroove(id)}
            style={{ width: chipW }}
            textStyle={{ fontSize: 12 }}
          />
        ))}
      </View>

      {/* 伴奏パターン */}
      <SectionTitle>伴奏パターン</SectionTitle>
      <ChipRow
        options={ACCOMPANIMENT_IDS.map((id) => ({ key: id, label: ACCOMPANIMENT_LABELS[id] }))}
        value={s.accompanimentPattern}
        onChange={(k) => session.setAccompaniment(k as AccompanimentPattern)}
        style={{ marginBottom: 20 }}
      />

      {/* 音量 */}
      <View style={styles.volPanel}>
        <VolumeSlider
          label="コード音"
          percent={volumeToPercent(volumes.chord)}
          onChange={(p) => handleVolumeChange('chord', p)}
        />
        <VolumeSlider
          label="ドラム"
          percent={volumeToPercent(volumes.drum)}
          onChange={(p) => handleVolumeChange('drum', p)}
        />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingBottom: 16 },
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
    paddingVertical: 14,
    paddingHorizontal: 15,
    marginBottom: 16,
  },
  progLabel: { fontSize: 10.5, color: colors.textFaint, fontFamily: font.semibold, fontWeight: '600', marginBottom: 10 },
  progEmpty: { fontSize: 12.5, color: colors.textDim },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progChip: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: 8, alignItems: 'center' },
  progChipText: { fontSize: 13, fontFamily: font.bold, fontWeight: '700' },
  progArrow: { color: colors.textFaintest },

  playPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    backgroundColor: colors.surfacePanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius['2xl'],
    paddingVertical: 16,
    marginBottom: 20,
  },
  bigPlay: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.75,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  bigPlayActive: { opacity: 0.85 },
  bigPlayDisabled: { opacity: 0.4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },

  volPanel: {
    backgroundColor: colors.surfacePanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xl,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginBottom: 18,
    gap: 13,
  },
});

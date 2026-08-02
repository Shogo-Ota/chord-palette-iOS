import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Chip, ChipRow, SectionTitle, VolumeSlider } from '@/components/controls';
import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { StyleCardGrid } from '@/components/StyleCardGrid';
import {
  ACCOMPANIMENT_HINTS,
  ACCOMPANIMENT_LABELS,
  ENABLED_INSTRUMENTS,
  INSTRUMENT_LABELS,
} from '@/data/labels';
import { beatsPerBarFor, sessionToPlaybackRequest } from '@/features/editor/playback';
import * as session from '@/features/editor/session';
import { getSession, useEditorSession } from '@/features/editor/session';
import { useLiveSoundReapply } from '@/features/editor/useLiveSoundReapply';
import { useStyleDraft } from '@/features/editor/useStyleDraft';
import { logger } from '@/lib/logger';
import { rescaleBeats } from '@/lib/performance/meter';
import {
  cardForSelection,
  CORE_PATTERNS,
  STYLE_CARDS,
  type StyleCardDef,
} from '@/lib/performance/model/styleCards';
import { percentToVolume, volumeToPercent } from '@/lib/volume';
import { track } from '@/services/analytics';
import { audioService } from '@/services/audio';
import { getTier } from '@/services/billing';
import { setOctaveShiftPref, setReleaseCutPref } from '@/repositories/sessionPrefsRepository';
import {
  VOLUME_DEFAULTS,
  type PlaybackState,
  type VolumeChannel,
  type VolumeLevels,
} from '@/services/audio/types';
import { colors, font, primaryGradient, radius } from '@/theme/tokens';
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
  const grooveChipW = (width - 40 - 8) / 2; // 2-col grid, 20 padH, 8 gap
  const s = useEditorSession();
  const styleDraft = useStyleDraft();
  // Audition source: committed session overlaid with the local style draft, so
  // previewing never mutates the session until the user confirms.
  const sound = useMemo(
    () => ({ ...s, ...styleDraft.draft }),
    [s, styleDraft.draft],
  );
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const playing = playbackState === 'playing';

  // 詳細設定 is closed by default (指示書 §16): the primary experience — style,
  // audition, instrument, apply — must complete without ever opening it.
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
    // Sync transport that may already be running under the editor stack.
    setPlaybackState(audioService.getState());
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
      // Flush any pending persist so the last drag position (incl. 0%) is saved.
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
    // Mute/unmute must hit the engine immediately (0% = silent). Persist is throttled.
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

  function handleReleaseCutChange(enabled: boolean) {
    session.setReleaseCut(enabled);
    setReleaseCutPref(enabled).catch((e) =>
      logger.error('Release-cut persist failed', { error: String(e) }),
    );
  }

  // Whole-arrangement register: 0 = original (bass floor C2), 1 = raised one
  // octave (bass floor C3). Device preference (mirrors release-cut) — applied
  // live via useLiveSoundReapply and to preview/export through the session.
  function handleOctaveChange(octaves: number) {
    session.setOctaveShift(octaves);
    setOctaveShiftPref(octaves).catch((e) =>
      logger.error('Octave-shift persist failed', { error: String(e) }),
    );
  }

  // Audition the current draft (never touches the session).
  function togglePlayback() {
    if (playing) {
      audioService.pause().catch((e) => logger.error('Audio pause failed', { error: String(e) }));
      return;
    }
    if (playbackState === 'paused') {
      audioService.resume().catch((e) => logger.error('Audio resume failed', { error: String(e) }));
      return;
    }
    if (sound.progression.length === 0) return;
    audioService
      .play(sessionToPlaybackRequest(sound, true, getTier()))
      .catch((e) => logger.error('Audio play failed', { error: String(e) }));
  }

  // Apply: reflect the draft into the session (drives the editor's play
  // button), then return. Audition audio already matches the draft.
  const handleConfirm = useCallback(() => {
    styleDraft.commit();
    router.back();
  }, [styleDraft, router]);

  // Discard (header back): if audio is auditioning an unconfirmed draft, rebuild
  // from the committed session so the editor doesn't keep playing a stale style.
  const handleBack = useCallback(() => {
    if (styleDraft.isDirty && audioService.getState() === 'playing') {
      const cur = getSession();
      if (cur.progression.length > 0) {
        // The playhead is counted in the draft rhythm's beats. If the draft changed
        // the meter, hand the committed plan the same place in the progression
        // rather than the same number (see rescaleBeats).
        const startBeat = rescaleBeats(
          audioService.getCurrentBeat(),
          beatsPerBarFor(sound.accompanimentPattern),
          beatsPerBarFor(cur.accompanimentPattern),
        );
        audioService
          .play({ ...sessionToPlaybackRequest(cur, true, getTier()), startBeat })
          .catch((e) => logger.error('Audio restore failed', { error: String(e) }));
      }
    }
    router.back();
  }, [styleDraft.isDirty, router, sound.accompanimentPattern]);

  // Rebuild (or audition) when the draft instrument / groove / accompaniment
  // (or the device-level release-cut) changes. Auditioning keeps the playhead's
  // place in the progression, so styles can be compared at the same spot.
  useLiveSoundReapply(playbackState, true, sound);

  // The card the current rhythm+groove pair came from; hand-tweaked = none.
  const selectedCard = cardForSelection(
    styleDraft.draft.accompanimentPattern,
    styleDraft.draft.grooveId,
  );

  // Tapping a card applies its FULL internal preset (ブラッシュアップ指示):
  // rhythm + drum groove into the draft, 余韻 / 音域 as immediate device prefs.
  function handleStyleSelect(card: StyleCardDef) {
    if (!card.preset) return;
    styleDraft.setAccompaniment(card.preset.pattern);
    styleDraft.setGroove(card.preset.grooveId);
    handleReleaseCutChange(card.preset.releaseCut);
    handleOctaveChange(card.preset.octaveShift);
    track('style_card_selected', { style: card.id });
  }

  // Audition summary stays short (ブラッシュアップ指示 §試聴UI): style + tone.
  const auditionSummary = [
    selectedCard?.label ?? ACCOMPANIMENT_LABELS[styleDraft.draft.accompanimentPattern],
    INSTRUMENT_LABELS[styleDraft.draft.instrumentId],
  ].join(' ・ ');

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={handleBack} hitSlop={8}>
          <Icon name="chevronLeft" size={17} color={colors.textSecondary} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>伴奏スタイル</Text>
      </View>

      {/* 1. Style — the screen's protagonist (指示書 §4/§6). */}
      <SectionTitle>スタイルを選ぶ</SectionTitle>
      <StyleCardGrid cards={STYLE_CARDS} selectedId={selectedCard?.id} onSelect={handleStyleSelect} />

      {/* 2. Current progression — context, deliberately quiet (指示書 §8). */}
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

      {/* 3. Audition — the heart of the screen (指示書 §7). */}
      <View style={styles.playPanel}>
        <Pressable
          onPress={togglePlayback}
          disabled={s.progression.length === 0}
          accessibilityRole="button"
          accessibilityLabel={playing ? '試聴を停止' : 'このスタイルを試聴'}>
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
        <Text style={styles.auditionTitle}>
          {playing ? '試聴中 — タップで停止' : 'このスタイルを試聴'}
        </Text>
        <Text style={styles.auditionHint}>
          {s.progression.length === 0 ? 'コードを追加すると試聴できます' : auditionSummary}
        </Text>
      </View>

      {/* 4. Instrument — below style in the hierarchy (指示書 §9). */}
      <SectionTitle>音色</SectionTitle>
      <ChipRow
        options={ENABLED_INSTRUMENTS.map((id) => ({ key: id, label: INSTRUMENT_LABELS[id] }))}
        value={styleDraft.draft.instrumentId}
        onChange={(k) => {
          styleDraft.setInstrument(k as InstrumentId);
          track('instrument_selected', { instrument: k });
        }}
        style={{ marginBottom: 20 }}
        chipStyle={{ paddingVertical: 12 }}
      />

      {/* 5. 詳細設定 — closed by default; the main flow never needs it (指示書 §10/§16). */}
      <Pressable
        onPress={() => setAdvancedOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: advancedOpen }}
        style={styles.advancedHeader}>
        <Text style={styles.advancedTitle}>詳細設定</Text>
        <View style={{ transform: [{ rotate: advancedOpen ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={15} color={colors.textFaint} strokeWidth={2.5} />
        </View>
      </Pressable>

      {advancedOpen && (
        <View style={styles.advancedBody}>
          {/* 伴奏パターン — 必要最低限の 4 種のみ（ブラッシュアップ指示）。
              スタイルカードが選ぶ内部リズム（relaxed 等）はここに出さない。 */}
          <SectionTitle>伴奏パターン</SectionTitle>
          <View style={styles.grid}>
            {CORE_PATTERNS.map((id) => (
              <Chip
                key={id}
                label={ACCOMPANIMENT_LABELS[id]}
                active={id === styleDraft.draft.accompanimentPattern}
                onPress={() => {
                  styleDraft.setAccompaniment(id);
                  track('accompaniment_selected', { accompaniment: id });
                }}
                style={{ width: grooveChipW }}
                textStyle={{ fontSize: 13 }}
              />
            ))}
          </View>
          <Text style={styles.patternHint} numberOfLines={2}>
            {ACCOMPANIMENT_HINTS[styleDraft.draft.accompanimentPattern]}
          </Text>

          {/* 音域 */}
          <SectionTitle>音域</SectionTitle>
          <ChipRow
            options={[
              { key: '0', label: '標準' },
              { key: '1', label: '高め' },
            ]}
            value={s.octaveShift >= 1 ? '1' : '0'}
            onChange={(k) => handleOctaveChange(Number(k))}
            style={{ marginBottom: 20 }}
          />

          {/* 余韻 */}
          <SectionTitle>余韻</SectionTitle>
          <ChipRow
            options={[
              { key: 'on', label: '自然' },
              { key: 'off', label: '短め' },
            ]}
            value={s.releaseCut ? 'off' : 'on'}
            onChange={(k) => handleReleaseCutChange(k === 'off')}
            style={{ marginBottom: 20 }}
          />

          {/* ドラム音量 — コード音量は固定（ブラッシュアップ指示 §④） */}
          <SectionTitle>ドラム音量</SectionTitle>
          <View style={styles.volPanel}>
            <VolumeSlider
              label="ドラム"
              percent={volumeToPercent(volumes.drum)}
              onChange={(p) => handleVolumeChange('drum', p)}
            />
          </View>
        </View>
      )}

      {/* 6. Apply — the user is choosing a whole setup, not just a tone (指示書 §17). */}
      <Pressable
        onPress={handleConfirm}
        accessibilityRole="button"
        accessibilityLabel="この設定を確定してコード進行画面に反映"
        style={styles.confirmWrap}>
        <LinearGradient
          colors={primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.confirmBtn, !styleDraft.isDirty && styles.confirmBtnIdle]}>
          <Icon name="check" size={18} color="#fff" strokeWidth={2.6} />
          <Text style={styles.confirmText}>この設定を使う</Text>
        </LinearGradient>
      </Pressable>
      <Text style={styles.confirmNote}>
        {styleDraft.isDirty ? '未確定の変更があります' : '現在の設定が反映済みです'}
      </Text>
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
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginTop: 16,
    marginBottom: 14,
  },
  progLabel: { fontSize: 10.5, color: colors.textFaint, fontFamily: font.semibold, fontWeight: '600', marginBottom: 8 },
  progEmpty: { fontSize: 12.5, color: colors.textDim },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progChip: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: 7, alignItems: 'center' },
  progChipText: { fontSize: 12.5, fontFamily: font.bold, fontWeight: '700' },
  progArrow: { color: colors.textFaintest },

  playPanel: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: colors.surfacePanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius['2xl'],
    paddingVertical: 18,
    marginBottom: 20,
  },
  auditionTitle: {
    fontSize: 13.5,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  auditionHint: { fontSize: 11.5, color: colors.textFaint, fontFamily: font.medium },

  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfacePanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  advancedTitle: { fontSize: 13.5, fontFamily: font.bold, fontWeight: '700', color: colors.textSecondary },
  advancedBody: { marginBottom: 8 },

  confirmWrap: { borderRadius: radius.pill, marginTop: 8, marginBottom: 6 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: radius.pill,
    shadowColor: colors.primary,
    shadowOpacity: 0.65,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  confirmBtnIdle: { shadowOpacity: 0.25 },
  confirmText: {
    fontSize: 15,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.4,
  },
  confirmNote: {
    fontSize: 11,
    color: colors.textFaint,
    fontFamily: font.medium,
    textAlign: 'center',
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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

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
    marginBottom: 18,
    gap: 13,
  },
});

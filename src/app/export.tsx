import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChordKeyboard } from '@/components/ChordKeyboard';
import { GradientText } from '@/components/GradientText';
import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useEditorSession } from '@/features/editor/session';
import { useMidiExport } from '@/features/export/useMidiExport';
import { VideoExportError } from '@/lib/errors';
import { progressionCycleDurationSec } from '@/lib/exportCycleTiming';
import { beatsPerBarFor } from '@/lib/performance/rhythms';
import { chordMidiNotes } from '@/lib/voicing';
import { track } from '@/services/analytics';
import { getTier } from '@/services/billing';
import { videoExportService } from '@/services/videoExport';
import { colors, font, functionColor, primaryGradient, radius, rainbow } from '@/theme/tokens';
import type { ChordEvent } from '@/types';

const ICON = require('../../assets/icon/icon.png');

const PREVIEW_W = 214;
const PREVIEW_PAD = 14;
const KEYBOARD_W = PREVIEW_W - PREVIEW_PAD * 2;

/** Preview dot sizing (mirrors the native encoder's fit-to-width behavior). */
const DOT_MAX = 8;
const DOT_MIN = 3.5;
const DOT_GAP_RATIO = 0.8; // gap = size * ratio

/**
 * Cycle through the progression for the in-app preview, honoring each chord's beat
 * length at the project's tempo. This is a preview only — the real synced render is
 * done natively (Phase 4), so a JS timer here is fine.
 */
function usePreviewIndex(progression: ChordEvent[], bpm: number): number {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    if (progression.length === 0) return;
    let cur = 0;
    let timer: ReturnType<typeof setTimeout>;
    const secPerBeat = 60 / Math.max(1, bpm);
    const schedule = () => {
      const dur = Math.max(0.25, (progression[cur]?.durationBeats ?? 4) * secPerBeat);
      timer = setTimeout(() => {
        cur = (cur + 1) % progression.length;
        setIdx(cur);
        schedule();
      }, dur * 1000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [progression, bpm]);
  return progression.length === 0 ? 0 : idx % progression.length;
}

export default function ExportScreen() {
  const router = useRouter();
  const s = useEditorSession();
  // Every exported clip is branded with the Chord Palette watermark (always on, no
  // opt-out) so shared videos always carry the mark. Kept as a const so the render
  // plan/preview paths stay explicit and unchanged.
  const watermark = true;
  const [busy, setBusy] = useState<'idle' | 'save' | 'share'>('idle');
  const [progress, setProgress] = useState(0);
  const saving = busy !== 'idle';
  const midi = useMidiExport();
  const exportBeatsPerBar = beatsPerBarFor(s.accompanimentPattern);
  const cycleDurationSec = progressionCycleDurationSec(
    s.progression,
    s.tempoBpm,
    exportBeatsPerBar,
  );

  function exportInput() {
    return {
      title: s.title,
      key: s.key,
      bpm: s.tempoBpm,
      progression: s.progression,
      grooveId: s.grooveId,
      accompaniment: s.accompanimentPattern,
      accompanimentVariant: s.accompanimentVariant,
      accompanimentEnergy: s.accompanimentEnergy,
      instrumentId: s.instrumentId,
      releaseCut: s.releaseCut,
      octaveShift: s.octaveShift,
      drumMode: s.drumMode,
      drumBeat: s.drumBeat,
      instrumentEffect: s.instrumentEffect,
      tier: getTier(),
    };
  }

  function runExport(kind: 'save' | 'share') {
    if (busy !== 'idle') return;
    if (s.progression.length === 0) {
      Alert.alert('コードがありません', '動画を書き出す前に進行を作成してください。');
      return;
    }
    setBusy(kind);
    setProgress(0);
    // One exact progression pass. Do not ceil to whole seconds: that would append
    // silence or the next loop's opening chord after the musical end boundary.
    const durationSec = cycleDurationSec;
    track('export_duration_selected', { durationSec });
    track('video_export_started', { kind, durationSec });
    const opts = { watermark, onProgress: setProgress };
    const work =
      kind === 'save'
        ? videoExportService.exportAndSave(exportInput(), opts)
        : videoExportService.exportAndShare(exportInput(), opts);
    work
      .then(() => {
        track('video_export_completed', { kind, durationSec });
        if (kind === 'save') {
          Alert.alert('保存しました', '写真アプリに動画を保存しました。');
        }
      })
      .catch((e) => {
        track('video_export_failed', { kind });
        const msg =
          e instanceof VideoExportError ? e.userMessage : '動画の書き出しに失敗しました。';
        Alert.alert('書き出しに失敗', msg, [
          { text: '再試行', onPress: () => runExport(kind) },
          { text: '閉じる', style: 'cancel' },
        ]);
      })
      .finally(() => setBusy('idle'));
  }

  async function runMidiExport() {
    const outcome = await midi.run(s);
    if (!outcome.ok) Alert.alert('MIDIを書き出せません', outcome.message);
  }

  const idx = usePreviewIndex(s.progression, s.tempoBpm);
  const current = s.progression[idx];
  const accent = current ? functionColor[current.function] : colors.primary;
  const notes = current ? chordMidiNotes(current, s.key, s.octaveShift) : [];
  const totalBeats = s.progression.reduce((sum, e) => sum + e.durationBeats, 0);
  const bars = Math.max(1, Math.ceil(totalBeats / 4));
  const autoDurationLabel = Number.isInteger(cycleDurationSec)
    ? String(cycleDurationSec)
    : cycleDurationSec.toFixed(1);

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevronLeft" size={17} color={colors.textSecondary} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>動画を書き出し</Text>
      </View>

      {/* 9:16 preview — matches the exported frame composition */}
      <View style={styles.preview}>
        <LinearGradient
          colors={[colors.screenGradientTop, colors.screenGradientMid, colors.appBg]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.pvTop}>
          <Text style={styles.pvTitle} numberOfLines={1}>
            {s.title}
          </Text>
          <Text style={styles.pvMeta}>
            {s.key} · BPM {s.tempoBpm} · {bars}小節
          </Text>
        </View>

        <View style={styles.pvCenter}>
          {current ? (
            <>
              <Text style={[styles.bigChord, { color: accent }]} numberOfLines={1}>
                {current.displayName}
              </Text>
              <Text style={styles.degree}>{current.degreeLabel}</Text>
            </>
          ) : (
            <Text style={styles.emptyChord}>コードがありません</Text>
          )}
        </View>

        {s.progression.length > 0 && (
          <View style={styles.pvStrip}>
            {(() => {
              // Mirror the native encoder: one dot per chord, sized to fit the strip
              // width for any count (up to the 16-bar max). The active dot stays
              // circular and is emphasized by full-color fill + a soft glow — never
              // stretched into a pill.
              const count = s.progression.length;
              const denom = count + DOT_GAP_RATIO * Math.max(0, count - 1);
              const size = Math.max(DOT_MIN, Math.min(DOT_MAX, KEYBOARD_W / denom));
              const gap = size * DOT_GAP_RATIO;
              return s.progression.map((c, i) => {
                const on = i === idx;
                const col = functionColor[c.function];
                return (
                  <View
                    key={c.id}
                    style={[
                      {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderWidth: 1.2,
                        marginHorizontal: gap / 2,
                        borderColor: col,
                      },
                      on
                        ? {
                            backgroundColor: col,
                            shadowColor: col,
                            shadowOpacity: 0.9,
                            shadowRadius: size * 0.9,
                            shadowOffset: { width: 0, height: 0 },
                          }
                        : { opacity: 0.4 },
                    ]}
                  />
                );
              });
            })()}
          </View>
        )}

        <View style={[styles.pvKeyboard, styles.pvKeyboardWithWatermark]}>
          <ChordKeyboard notes={notes} musicKey={s.key} color={accent} width={KEYBOARD_W} />
        </View>

        <View style={styles.watermarkRow}>
          <Image source={ICON} style={styles.wmIcon} />
          <Text style={styles.wmText}>Chord </Text>
          <GradientText colors={rainbow} style={styles.wmText}>
            Palette
          </GradientText>
        </View>
      </View>

      {/* 長さ（BPM・小節数から自動算出） */}
      <View style={styles.optRow}>
        <Text style={styles.optLabel}>長さ</Text>
        <View style={styles.formatVal}>
          <Text style={styles.formatMain}>約{autoDurationLabel}秒</Text>
          <Text style={styles.formatSub}>
            自動（{bars}小節 · BPM {s.tempoBpm}）
          </Text>
        </View>
      </View>

      {/* actions — save is primary; share opens the system sheet (Phase 4B) */}
      <Pressable style={styles.saveBtnWrap} onPress={() => runExport('save')} disabled={saving}>
        <LinearGradient
          colors={primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}>
          <Icon name="download" size={17} color="#fff" strokeWidth={2.2} />
          <Text style={styles.saveBtnText}>
            {busy === 'save' ? `書き出し中… ${Math.round(progress * 100)}%` : '写真に保存'}
          </Text>
        </LinearGradient>
      </Pressable>
      <Pressable
        style={[styles.shareBtn, saving && styles.saveBtnDisabled]}
        onPress={() => runExport('share')}
        disabled={saving}>
        <Icon name="share" size={16} color={colors.textSecondary} strokeWidth={2.2} />
        <Text style={styles.shareBtnText}>
          {busy === 'share' ? `書き出し中… ${Math.round(progress * 100)}%` : '共有する'}
        </Text>
      </Pressable>

      {/* MIDI — the same performance the app plays, as a Standard MIDI File */}
      <Pressable
        style={[styles.midiBtn, (midi.exporting || saving) && styles.saveBtnDisabled]}
        onPress={runMidiExport}
        disabled={midi.exporting || saving}
        accessibilityRole="button"
        accessibilityLabel="MIDIを書き出す"
        accessibilityHint="DAWで開けるMIDIファイルを共有します">
        <Icon name="download" size={16} color={colors.primaryBlue} strokeWidth={2.2} />
        <Text style={styles.midiBtnText}>
          {midi.exporting ? 'MIDIを書き出し中…' : 'MIDIを書き出す'}
        </Text>
      </Pressable>
      <Text style={styles.midiNote}>再生と同じ演奏内容をMIDIで書き出します</Text>
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

  preview: {
    width: PREVIEW_W,
    height: 380,
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: radius['4xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderFaint,
    paddingHorizontal: PREVIEW_PAD,
    paddingTop: 22,
    paddingBottom: 16,
  },
  pvTop: { alignItems: 'center' },
  pvTitle: {
    fontSize: 15,
    fontFamily: font.extrabold,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  pvMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 3,
    fontFamily: font.semibold,
    fontWeight: '600',
  },

  pvCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bigChord: { fontSize: 46, fontFamily: font.black, fontWeight: '900', lineHeight: 50 },
  degree: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4,
    fontFamily: font.bold,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyChord: { fontSize: 13, color: colors.textDim, fontFamily: font.semibold, fontWeight: '600' },

  pvStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  pvKeyboard: { alignItems: 'center' },
  pvKeyboardWithWatermark: { marginBottom: 26 },

  watermarkRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    opacity: 0.55,
  },
  wmIcon: { width: 16, height: 16 },
  wmText: { fontSize: 9.5, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },

  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 11,
  },
  optLabel: {
    fontSize: 13.5,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  formatVal: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formatMain: { fontSize: 13, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },
  formatSub: { fontSize: 11, color: '#7f8aa0' },

  saveBtnWrap: { marginTop: 2 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius['2xl'],
    paddingVertical: 15,
    shadowColor: colors.primary,
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  saveBtnText: { fontSize: 14, fontFamily: font.bold, fontWeight: '700', color: '#fff' },
  saveBtnDisabled: { opacity: 0.55 },
  shareBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius['2xl'],
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareBtnText: {
    fontSize: 14,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  midiBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius['2xl'],
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  midiBtnText: {
    fontSize: 14,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.primaryBlue,
  },
  midiNote: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: font.medium,
    color: colors.textFaint,
  },
});

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChordKeyboard } from '@/components/ChordKeyboard';
import { Icon } from '@/components/Icon';
import { Toggle } from '@/components/controls';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useEditorSession } from '@/features/editor/session';
import { VideoExportError } from '@/lib/errors';
import { chordMidiNotes } from '@/lib/voicing';
import { videoExportService } from '@/services/videoExport';
import { colors, font, functionColor, primaryGradient, radius } from '@/theme/tokens';
import type { ChordEvent } from '@/types';

const ICON = require('../../assets/icon/icon.png');

const PREVIEW_W = 214;
const PREVIEW_PAD = 14;
const KEYBOARD_W = PREVIEW_W - PREVIEW_PAD * 2;

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
  const [duration, setDuration] = useState('30');
  const [watermark, setWatermark] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleSaveToPhotos() {
    if (saving) return;
    if (s.progression.length === 0) {
      Alert.alert('コードがありません', '動画を書き出す前に進行を作成してください。');
      return;
    }
    setSaving(true);
    setProgress(0);
    try {
      await videoExportService.exportAndSave(
        {
          title: s.title,
          key: s.key,
          bpm: s.tempoBpm,
          progression: s.progression,
          grooveId: s.grooveId,
          instrumentId: s.instrumentId,
        },
        { durationSec: Number(duration), watermark, onProgress: setProgress },
      );
      Alert.alert('保存しました', '写真アプリに動画を保存しました。');
    } catch (e) {
      const msg = e instanceof VideoExportError ? e.userMessage : '動画の書き出しに失敗しました。';
      Alert.alert('書き出しに失敗', msg);
    } finally {
      setSaving(false);
    }
  }

  const idx = usePreviewIndex(s.progression, s.tempoBpm);
  const current = s.progression[idx];
  const accent = current ? functionColor[current.function] : colors.primary;
  const notes = current ? chordMidiNotes(current, s.key) : [];
  const totalBeats = s.progression.reduce((sum, e) => sum + e.durationBeats, 0);
  const bars = Math.max(1, Math.ceil(totalBeats / 4));

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
        <View style={styles.badge916}>
          <Text style={styles.badge916Text}>9:16</Text>
        </View>

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
            {s.progression.slice(0, 8).map((c, i) => {
              const on = i === idx;
              const col = functionColor[c.function];
              return (
                <View
                  key={c.id}
                  style={[
                    styles.stripDot,
                    { borderColor: col },
                    on && { backgroundColor: col, width: 14 },
                  ]}
                />
              );
            })}
          </View>
        )}

        <View style={styles.pvKeyboard}>
          <ChordKeyboard notes={notes} musicKey={s.key} color={accent} width={KEYBOARD_W} />
        </View>

        {watermark && (
          <View style={styles.watermarkRow}>
            <Image source={ICON} style={styles.wmIcon} />
            <Text style={styles.wmText}>
              Chord <Text style={{ color: colors.purpleText }}>Palette</Text>
            </Text>
          </View>
        )}
      </View>

      {/* 長さ */}
      <View style={styles.optRow}>
        <Text style={styles.optLabel}>長さ</Text>
        <View style={styles.durTrack}>
          {[
            { key: '15', label: '15秒' },
            { key: '30', label: '30秒' },
            { key: '60', label: '60秒' },
          ].map((o) => {
            const active = o.key === duration;
            return (
              <Pressable key={o.key} onPress={() => setDuration(o.key)}>
                {active ? (
                  <LinearGradient
                    colors={primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.durActive}>
                    <Text style={styles.durTextActive}>{o.label}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.durText}>{o.label}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* フォーマット */}
      <View style={styles.optRowTall}>
        <Text style={styles.optLabel}>フォーマット</Text>
        <View style={styles.formatVal}>
          <Text style={styles.formatMain}>縦動画 (9:16)</Text>
          <Text style={styles.formatSub}>1080×1920</Text>
          <Icon name="chevronRight" size={14} color="#7f8aa0" strokeWidth={2.4} />
        </View>
      </View>

      {/* ウォーターマーク */}
      <View style={styles.optRowTall}>
        <View>
          <Text style={styles.optLabel2}>ウォーターマーク</Text>
          <Text style={styles.optSub}>アプリアイコンを表示</Text>
        </View>
        <Toggle value={watermark} onValueChange={setWatermark} width={46} height={28} />
      </View>

      {/* action — primary CTA: the real "save to Photos" export */}
      <Pressable style={styles.saveBtnWrap} onPress={handleSaveToPhotos} disabled={saving}>
        <LinearGradient
          colors={primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}>
          <Icon name="download" size={17} color="#fff" strokeWidth={2.2} />
          <Text style={styles.saveBtnText}>
            {saving ? `書き出し中… ${Math.round(progress * 100)}%` : '写真に保存'}
          </Text>
        </LinearGradient>
      </Pressable>
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
  badge916: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badge916Text: { fontSize: 8, fontFamily: font.bold, fontWeight: '700', color: colors.textSecondary },

  pvTop: { alignItems: 'center' },
  pvTitle: { fontSize: 15, fontFamily: font.extrabold, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.3 },
  pvMeta: { fontSize: 10, color: colors.textMuted, marginTop: 3, fontFamily: font.semibold, fontWeight: '600' },

  pvCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bigChord: { fontSize: 46, fontFamily: font.black, fontWeight: '900', lineHeight: 50 },
  degree: { fontSize: 15, color: colors.textSecondary, marginTop: 4, fontFamily: font.bold, fontWeight: '700', letterSpacing: 0.5 },
  emptyChord: { fontSize: 13, color: colors.textDim, fontFamily: font.semibold, fontWeight: '600' },

  pvStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 12 },
  stripDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.2 },

  pvKeyboard: { alignItems: 'center' },

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
  wmIcon: { width: 16, height: 16, borderRadius: 5 },
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
  optRowTall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
    marginBottom: 11,
  },
  optLabel: { fontSize: 13.5, fontFamily: font.semibold, fontWeight: '600', color: colors.textSecondary },
  optLabel2: { fontSize: 13.5, fontFamily: font.semibold, fontWeight: '600', color: colors.textSecondary },
  optSub: { fontSize: 11, color: colors.textFaint, marginTop: 3 },

  durTrack: { flexDirection: 'row', gap: 5, backgroundColor: colors.surfaceInput, borderRadius: radius.md, padding: 3 },
  durActive: { borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  durText: { fontSize: 12, fontFamily: font.semibold, fontWeight: '600', color: colors.textDim, paddingHorizontal: 12, paddingVertical: 6 },
  durTextActive: { fontSize: 12, fontFamily: font.bold, fontWeight: '700', color: '#fff' },

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
});

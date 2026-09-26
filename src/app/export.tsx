import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useEditorSession } from '@/features/editor/session';
import { useMidiExport } from '@/features/export/useMidiExport';
import { StandardVideoPreview } from '@/features/videoExport/StandardVideoPreview';
import { VideoVisualStyleSelector } from '@/features/videoExport/VideoVisualStyleSelector';
import { useVideoVisualStylePreference } from '@/features/videoExport/useVideoVisualStylePreference';
import { VideoExportError } from '@/lib/errors';
import { progressionCycleDurationSec } from '@/lib/exportCycleTiming';
import { beatsPerBarFor } from '@/lib/performance/rhythms';
import { track } from '@/services/analytics';
import { getTier } from '@/services/billing';
import { videoExportService } from '@/services/videoExport';
import { colors, font, primaryGradient, radius } from '@/theme/tokens';

export default function ExportScreen() {
  const router = useRouter();
  const s = useEditorSession();
  // Every exported clip is branded with the Chord Palette watermark (always on, no
  // opt-out) so shared videos always carry the mark. Kept as a const so the render
  // plan/preview paths stay explicit and unchanged.
  const watermark = true;
  const [busy, setBusy] = useState<'idle' | 'save' | 'share'>('idle');
  const [progress, setProgress] = useState(0);
  const midi = useMidiExport();
  const { visualStyle, selectVisualStyle } = useVideoVisualStylePreference();
  const tier = getTier();
  const saving = busy !== 'idle';
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
      mode: s.mode,
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
      tier,
      visualStyle,
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

  const totalBeats = s.progression.reduce((sum, e) => sum + e.durationBeats, 0);
  const bars = Math.max(1, Math.ceil(totalBeats / 4));
  const autoDurationLabel = Number.isInteger(cycleDurationSec)
    ? String(cycleDurationSec)
    : cycleDurationSec.toFixed(1);
  const saveLabel = busy === 'save' ? `書き出し中… ${Math.round(progress * 100)}%` : '写真に保存';
  const shareLabel = busy === 'share' ? `書き出し中… ${Math.round(progress * 100)}%` : '共有する';

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevronLeft" size={17} color={colors.textSecondary} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>動画を書き出し</Text>
      </View>

      {/* 9:16 preview — matches the exported frame composition */}
      <StandardVideoPreview
        title={s.title}
        musicKey={s.key}
        bpm={s.tempoBpm}
        bars={bars}
        progression={s.progression}
        octaveShift={s.octaveShift}
      />

      <VideoVisualStyleSelector
        value={visualStyle}
        onChange={selectVisualStyle}
        disabled={saving}
      />

      {/* 長さ（BPM・小節数から自動算出） */}
      <View style={styles.optRow}>
        <Text style={styles.optLabel}>長さ</Text>
        <View style={styles.formatVal}>
          <Text style={styles.formatMain}>約{autoDurationLabel}秒</Text>
          <Text style={styles.formatSub}>{`自動（${bars}小節 · BPM ${s.tempoBpm}）`}</Text>
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
          <Text style={styles.saveBtnText}>{saveLabel}</Text>
        </LinearGradient>
      </Pressable>
      <Pressable
        style={[styles.shareBtn, saving && styles.saveBtnDisabled]}
        onPress={() => runExport('share')}
        disabled={saving}>
        <Icon name="share" size={16} color={colors.textSecondary} strokeWidth={2.2} />
        <Text style={styles.shareBtnText}>{shareLabel}</Text>
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

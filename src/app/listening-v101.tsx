/**
 * v1.01 Human MIDI — 実機リスニング専用画面。
 * 管理者モード ON 時のみホームから入れる。Production Pattern 3本 × 代表6コード。
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChipRow } from '@/components/controls';
import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { ENABLED_INSTRUMENTS, INSTRUMENT_LABELS } from '@/data/labels';
import { sessionToPlaybackRequest } from '@/features/editor/playback';
import {
  getSession,
  loadPhase3cListeningCase,
  loadV101ListeningLab,
  setInstrument,
  useEditorSession,
  V101_LISTENING_PATTERNS,
  type ListeningPatternPreset,
  type Phase3cCaseId,
} from '@/features/editor/session';
import { PHASE3C_CASES } from '@/lib/playback/phase3cCases';
import { logger } from '@/lib/logger';
import { V101_LISTENING_CHECKLIST } from '@/lib/performance/humanTemplate/listeningProgression';
import { audioService } from '@/services/audio';
import { activePlaybackEngine, setPlaybackEngineOverride } from '@/services/audio/playbackEngine';
import { getTier } from '@/services/billing';
import type { PlaybackEngineId, PlaybackState } from '@/services/audio/types';
import { colors, font, primaryGradient, radius } from '@/theme/tokens';
import type { InstrumentId } from '@/types';


/**
 * Playback engine A/B (diagnostic only — never exposed in the product UI).
 * `sampled` is the shipping pre-rendered path; `sequencer` is the realtime sampler
 * (`docs/audio/playback_ab_test.md`). Both are fed the identical Final MIDI, so a
 * difference heard here is a difference in the engine.
 */
const ENGINE_OPTIONS = [
  { key: 'sampled', label: 'OLD 事前録音' },
  { key: 'sequencer', label: 'NEW Sampler' },
];

const ENGINE_HINT: Record<PlaybackEngineId, string> = {
  sampled: 'OLD — 固定サンプル合算（CC64なし・音域24–84でクランプ）',
  sequencer: 'NEW — Final MIDI を Sampler へ送出（CC64あり・Pitch 0–127・clampなし）',
};

type ListeningCaseId = 'v101' | Phase3cCaseId;

const CASE_OPTIONS: Array<{ id: ListeningCaseId; label: string }> = [
  { id: 'natural-type1', label: '3C Natural' },
  { id: 'variation-type1', label: '3C Variation' },
  { id: 'v101', label: 'v1.01 Lab' },
];

export default function ListeningV101Screen() {
  const router = useRouter();
  const session = useEditorSession();
  const [listeningCase, setListeningCase] = useState<ListeningCaseId>('natural-type1');
  const [patternIdx, setPatternIdx] = useState(0);
  const [engine, setEngine] = useState<PlaybackEngineId>(activePlaybackEngine());
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [engineNote, setEngineNote] = useState('エンジン準備中…');
  const playing = playbackState === 'playing';
  const pattern = V101_LISTENING_PATTERNS[patternIdx]!;
  const phase3c = listeningCase === 'v101' ? null : PHASE3C_CASES[listeningCase];

  useEffect(() => {
    if (listeningCase === 'v101') {
      loadV101ListeningLab(pattern);
      return;
    }
    loadPhase3cListeningCase(listeningCase);
  }, [listeningCase, patternIdx]);

  useEffect(() => {
    audioService
      .prepare()
      .then(() => setEngineNote('準備完了。OLD / NEW を選んで再生してください。'))
      .catch((e) => {
        logger.error('Listening prepare failed', { error: String(e) });
        setEngineNote(`prepare失敗: ${String(e)}`);
      });
    setPlaybackState(audioService.getState());
    const sub = audioService.addStateListener((e) => setPlaybackState(e.state));
    return () => sub?.remove();
  }, []);

  const togglePlayback = useCallback(() => {
    if (playing) {
      audioService
        .pause()
        .catch((e) => logger.error('Listening pause failed', { error: String(e) }));
      return;
    }
    if (playbackState === 'paused') {
      audioService
        .resume()
        .catch((e) => logger.error('Listening resume failed', { error: String(e) }));
      return;
    }
    const s = getSession();
    if (s.progression.length === 0) {
      setEngineNote('進行が空です。Pattern を選び直してください。');
      return;
    }
    const req = sessionToPlaybackRequest(s, true, getTier());
    audioService
      .prepare()
      .then(() => audioService.play(req))
      .then(() => audioService.getDiagnostics())
      .then((diag) => {
        const rt = diag?.realtime;
        const err = rt?.lastError;
        const count = rt?.scheduledEventCount;
        const pitchMin = rt?.sentPitchMin;
        const pitchMax = rt?.sentPitchMax;
        const pitch =
          pitchMin != null && pitchMax != null ? ` pitch=${pitchMin}-${pitchMax}` : '';
        const cc = rt?.sentCc64Count != null ? ` cc64=${rt.sentCc64Count}` : '';
        setEngineNote(
          err
            ? `ERROR: ${err}`
            : `${diag?.activeEngine ?? engine} / events=${count ?? req.midiEvents?.length ?? 0}${pitch}${cc} / ${req.planSignature ?? '-'}`,
        );
      })
      .catch((e) => {
        logger.error('Listening play failed', { error: String(e) });
        setEngineNote(`play失敗: ${String(e)}`);
      });
  }, [playing, playbackState, engine]);

  const selectCase = (id: ListeningCaseId) => {
    if (playing) {
      audioService.stop().catch(() => {});
    }
    setListeningCase(id);
  };

  const selectPattern = (preset: ListeningPatternPreset, idx: number) => {
    if (playing) {
      audioService.stop().catch(() => {});
    }
    setPatternIdx(idx);
  };

  const selectInstrument = (id: InstrumentId) => {
    setInstrument(id);
  };

  /** Stop first: the engines own separate voices, so a running take must be silenced. */
  const selectEngine = (id: PlaybackEngineId) => {
    audioService.stop().catch(() => {});
    setPlaybackEngineOverride(id);
    setEngine(id);
    audioService
      .logDiagnostics(`engine=${id}`)
      .catch((e) => logger.warn('engine diagnostics failed', { error: String(e) }));
  };

  return (
    <ScreenScaffold scroll={false}>
      <Pressable
        onPress={() => {
          audioService.stop().catch(() => {});
          router.back();
        }}
        accessibilityRole="button"
        style={styles.backRow}>
        <Icon name="chevronLeft" size={20} color={colors.textSecondary} />
        <Text style={styles.backLabel}>v1.01 Listening</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Phase 3C: 同一 Final MIDI を OLD=sampled / NEW=sequencer で即時比較します。Generation
          は変えません。
        </Text>

        <Text style={styles.section}>Case</Text>
        <View style={styles.patternRow}>
          {CASE_OPTIONS.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => selectCase(c.id)}
              style={[styles.patternChip, listeningCase === c.id && styles.patternChipActive]}>
              <Text
                style={[
                  styles.patternLabel,
                  listeningCase === c.id && styles.patternLabelActive,
                ]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Playback Engine（A/B）</Text>
        <ChipRow
          options={ENGINE_OPTIONS}
          value={engine}
          onChange={(k) => selectEngine(k as PlaybackEngineId)}
          chipStyle={{ paddingVertical: 12 }}
        />
        <Text style={styles.engineHint}>{ENGINE_HINT[engine]}</Text>
        <Text style={styles.engineNote}>{engineNote}</Text>

        {listeningCase === 'v101' ? (
          <>
            <Text style={styles.section}>Pattern</Text>
            <View style={styles.patternRow}>
              {V101_LISTENING_PATTERNS.map((p, i) => (
                <Pressable
                  key={p.slot}
                  onPress={() => selectPattern(p, i)}
                  style={[styles.patternChip, i === patternIdx && styles.patternChipActive]}>
                  <Text
                    style={[styles.patternLabel, i === patternIdx && styles.patternLabelActive]}>
                    {p.label}
                  </Text>
                  <Text style={styles.patternMeta}>{p.templateId.split('.').slice(-1)[0]}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.section}>
          {phase3c
            ? `コード進行（${phase3c.key} · 70 BPM · Drum OFF · Effect OFF）`
            : 'コード進行（C major · 72 BPM）'}
        </Text>
        <View style={styles.progRow}>
          {session.progression.map((c, i, arr) => (
            <React.Fragment key={c.id}>
              <View style={styles.progChip}>
                <Text style={styles.progText}>{c.displayName}</Text>
              </View>
              {i < arr.length - 1 && <Text style={styles.arrow}>→</Text>}
            </React.Fragment>
          ))}
        </View>

        {ENABLED_INSTRUMENTS.length > 1 && (
          <>
            <Text style={styles.section}>音色</Text>
            <ChipRow
              options={ENABLED_INSTRUMENTS.map((id) => ({ key: id, label: INSTRUMENT_LABELS[id] }))}
              value={session.instrumentId}
              onChange={(k) => selectInstrument(k as InstrumentId)}
              chipStyle={{ paddingVertical: 12 }}
            />
          </>
        )}

        <View style={styles.playPanel}>
          <Pressable onPress={togglePlayback} accessibilityRole="button">
            <LinearGradient
              colors={primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.bigPlay, playing && styles.bigPlayActive]}>
              <Icon name={playing ? 'pause' : 'play'} size={28} color="#fff" />
            </LinearGradient>
          </Pressable>
          <Text style={styles.playTitle}>
            {playing ? '試聴中 — タップで停止' : '試聴開始（ループ）'}
          </Text>
          <Text style={styles.playHint}>
            {phase3c
              ? `${phase3c.label} · ${INSTRUMENT_LABELS[session.instrumentId]} · Type1`
              : `${pattern.label} · ${INSTRUMENT_LABELS[session.instrumentId]} · ${pattern.templateId}`}
          </Text>
        </View>

        <Text style={styles.section}>確認チェックリスト</Text>
        {(phase3c
          ? [
              'NEW でペダル（CC64）が Export MIDI と同じ長さに聞こえる',
              'Variation の高い音（85–90）が C6 に潰れない',
              'OLD はペダルなし・高音 clamp、NEW は Final MIDI に近い',
              '同一 Case のまま OLD / NEW を切り替えて比較する',
            ]
          : V101_LISTENING_CHECKLIST
        ).map((item) => (
          <View key={item} style={styles.checkRow}>
            <Text style={styles.checkBullet}>□</Text>
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          各 Pattern を試聴後、PASS / FAIL を報告してください。
        </Text>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backLabel: {
    fontSize: 15,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  engineHint: {
    fontSize: 11,
    fontFamily: font.regular,
    color: colors.textFaint,
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 6,
  },
  engineNote: {
    fontSize: 11,
    fontFamily: font.regular,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 16,
  },
  lead: {
    fontSize: 14,
    fontFamily: font.regular,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 20,
  },
  section: {
    fontSize: 12,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.textFaint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },
  patternRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  patternChip: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  patternChipActive: {
    borderColor: colors.primaryBlue,
    backgroundColor: 'rgba(99, 179, 237, 0.12)',
  },
  patternLabel: {
    fontSize: 14,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  patternLabelActive: { color: colors.textPrimary },
  patternMeta: {
    fontSize: 10,
    fontFamily: font.regular,
    color: colors.textFaint,
    marginTop: 4,
  },
  progRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  progChip: {
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  progText: {
    fontSize: 13,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  arrow: { color: colors.textFaint, fontSize: 12 },
  playPanel: { alignItems: 'center', marginVertical: 24 },
  bigPlay: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  bigPlayActive: { opacity: 0.85 },
  playTitle: {
    fontSize: 16,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  playHint: {
    fontSize: 12,
    fontFamily: font.regular,
    color: colors.textFaint,
    marginTop: 6,
    textAlign: 'center',
  },
  checkRow: { flexDirection: 'row', gap: 8, marginBottom: 8, paddingRight: 8 },
  checkBullet: { fontSize: 14, color: colors.textFaint, width: 18 },
  checkText: {
    flex: 1,
    fontSize: 14,
    fontFamily: font.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    marginTop: 20,
    fontSize: 12,
    fontFamily: font.regular,
    color: colors.textFaint,
    lineHeight: 18,
  },
});

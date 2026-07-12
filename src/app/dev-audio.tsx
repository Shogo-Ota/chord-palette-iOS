import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { audioService } from '@/services/audio';
import { buildVerificationRequest, verificationPreview } from '@/services/audio/fixtures';
import {
  VOLUME_DEFAULTS,
  type AudioDiagnostics,
  type PlaybackState,
  type VolumeChannel,
} from '@/services/audio/types';
import { colors, font, radius, spacing } from '@/theme/tokens';

/**
 * VERIFICATION-ONLY screen (Phase 2A). Not part of the product flow — it exists
 * to validate the native audio path on a Dev Build. The fixed progression comes
 * from `services/audio/fixtures` (TypeScript), never from Swift.
 */
export default function DevAudioScreen() {
  const available = audioService.isAvailable();
  const [state, setState] = useState<PlaybackState>(audioService.getState());
  const [position, setPosition] = useState<{ chordIndex: number; beat: number; loopCount: number }>(
    { chordIndex: -1, beat: 0, loopCount: 0 },
  );
  const [volumes, setVolumes] = useState(VOLUME_DEFAULTS);
  const [diag, setDiag] = useState<AudioDiagnostics | null>(null);

  useEffect(() => {
    const stateSub = audioService.addStateListener((e) => setState(e.state));
    const posSub = audioService.addPositionListener((e) =>
      setPosition({ chordIndex: e.chordIndex, beat: e.beat, loopCount: e.loopCount }),
    );
    return () => {
      stateSub?.remove();
      posSub?.remove();
      // Release the engine when leaving the screen (engine-release test item).
      audioService.teardown().catch(() => undefined);
    };
  }, []);

  const onPrepare = async () => {
    await audioService.prepare();
    setState(audioService.getState());
    const v = audioService.getVolumes();
    if (v) setVolumes(v);
    setDiag(await audioService.logDiagnostics('dev-audio: after prepare'));
  };

  const onDiagnose = async () => {
    setDiag(await audioService.logDiagnostics('dev-audio: manual'));
  };

  const onPlay = () => audioService.play(buildVerificationRequest(true));
  const onPreview = () => audioService.previewChord(verificationPreview());

  const changeVolume = async (channel: VolumeChannel, value: number) => {
    const clamped = Math.min(1, Math.max(0, Math.round(value * 100) / 100));
    setVolumes((prev) => ({ ...prev, [channel]: clamped }));
    await audioService.setVolume(channel, clamped);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Dev Audio (2A 検証)' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {!available && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              ネイティブ音声モジュールが未リンクです。EAS Development Build で実行してください（Expo Go
              では動作しません）。
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>状態</Text>
          <Text style={styles.state}>{state}</Text>
          <Text style={styles.meta}>
            コード #{position.chordIndex} / beat {position.beat.toFixed(2)} / loop{' '}
            {position.loopCount}
          </Text>
          <Text style={styles.meta}>engine: {audioService.getVersion() ?? '—'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>SoundFont 診断</Text>
          <View style={styles.row}>
            <Btn label="診断を取得" onPress={onDiagnose} />
          </View>
          {diag ? (
            <>
              <Text style={styles.meta}>
                found: {String(diag.soundFontFound)} / sampledLoaded:{' '}
                {String(diag.sampledLoaded)}
              </Text>
              <Text style={styles.meta}>
                bytes: {diag.soundFontBytes ?? '—'}
                {typeof diag.soundFontBytes === 'number' && diag.soundFontBytes < 1000
                  ? '  ← LFS ポインタの疑い'
                  : ''}
              </Text>
              <Text style={styles.meta}>path: {diag.soundFontPath ?? '—'}</Text>
              <Text style={styles.meta}>instrument: {diag.currentInstrument ?? '—'}</Text>
              {diag.lastLoadError ? (
                <Text style={styles.meta}>error: {diag.lastLoadError}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.meta}>未取得（「準備」または「診断を取得」を押す）</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>進行: Cmaj7 → G7 → Am7 → Fmaj7 (120 BPM / loop)</Text>
          <View style={styles.row}>
            <Btn label="準備" onPress={onPrepare} />
            <Btn label="プレビュー" onPress={onPreview} />
          </View>
          <View style={styles.row}>
            <Btn label="再生" onPress={onPlay} primary />
            <Btn label="一時停止" onPress={() => audioService.pause()} />
          </View>
          <View style={styles.row}>
            <Btn label="再開" onPress={() => audioService.resume()} />
            <Btn label="停止" onPress={() => audioService.stop()} />
          </View>
        </View>

        {(['master', 'chord', 'drum'] as VolumeChannel[]).map((ch) => (
          <View style={styles.card} key={ch}>
            <Text style={styles.cardTitle}>
              {ch} 音量: {volumes[ch].toFixed(2)}
            </Text>
            <View style={styles.row}>
              <Btn label="0.0" onPress={() => changeVolume(ch, 0)} />
              <Btn label="−0.1" onPress={() => changeVolume(ch, volumes[ch] - 0.1)} />
              <Btn label="+0.1" onPress={() => changeVolume(ch, volumes[ch] + 0.1)} />
              <Btn label="1.0" onPress={() => changeVolume(ch, 1)} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Btn({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        primary && styles.btnPrimary,
        pressed && styles.btnPressed,
      ]}
    >
      <Text style={[styles.btnText, primary && styles.btnTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: spacing.xl, gap: spacing.lg },
  banner: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  bannerText: { color: colors.dangerSoft, fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { color: colors.textHeading, fontFamily: font.semibold, fontSize: 14 },
  state: { color: colors.primaryBlue, fontFamily: font.bold, fontSize: 22 },
  meta: { color: colors.textMuted, fontFamily: font.regular, fontSize: 12 },
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  btn: {
    flexGrow: 1,
    minWidth: 72,
    alignItems: 'center',
    backgroundColor: colors.surfaceIconBtn,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPressed: { opacity: 0.7 },
  btnText: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14 },
  btnTextPrimary: { color: colors.white },
});

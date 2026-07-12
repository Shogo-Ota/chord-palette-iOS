import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { GradientText } from '@/components/GradientText';
import { Icon } from '@/components/Icon';
import { Toggle } from '@/components/controls';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { colors, font, primaryGradient, radius, rainbowFull } from '@/theme/tokens';

const ICON = require('../../assets/icon/icon.png');

const STRIP = [
  { name: 'Cmaj7', text: '#8fb6f2', border: 'rgba(59,130,246,0.5)', bw: 1, bg: 'transparent' as const },
  { name: 'G7', text: '#f0918f', border: 'rgba(239,68,68,0.5)', bw: 1, bg: 'transparent' as const },
  { name: 'Am7', text: '#ffb838', border: '#ffb838', bw: 1.5, bg: 'rgba(255,184,56,0.12)' },
  { name: 'Fmaj7', text: '#7fd99b', border: 'rgba(34,197,94,0.5)', bw: 1, bg: 'transparent' as const },
] as const;

const BAR_COUNT = 26;

export default function ExportScreen() {
  const router = useRouter();
  const [duration, setDuration] = React.useState('30');
  const [watermark, setWatermark] = React.useState(false);

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevronLeft" size={17} color={colors.textSecondary} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>動画を書き出し</Text>
      </View>

      {/* 9:16 preview */}
      <View style={styles.preview}>
        <LinearGradient
          colors={['#1a1140', '#0b0a1c', '#07060f']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.badge916}>
          <Text style={styles.badge916Text}>9:16</Text>
        </View>

        <View style={styles.previewTop}>
          <Text style={styles.previewTitle}>Morning Sketch</Text>
          <Text style={styles.previewMeta}>BPM 120 · 4小節</Text>
        </View>

        <View style={styles.previewCenter}>
          <GradientText colors={['#ff5a6e', '#ff9d3f', '#ffd23f']} style={styles.bigChord} end={{ x: 1, y: 0.6 }}>
            Am7
          </GradientText>
          <Text style={styles.chordDesc}>温かく柔らかな響き</Text>
        </View>

        <EqBars />

        <View style={styles.strip}>
          {STRIP.map((c, i) => (
            <React.Fragment key={c.name}>
              <View style={[styles.stripChip, { borderColor: c.border, borderWidth: c.bw, backgroundColor: c.bg }]}>
                <Text style={[styles.stripText, { color: c.text }]}>{c.name}</Text>
              </View>
              {i < STRIP.length - 1 && <Text style={styles.stripArrow}>›</Text>}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.watermarkRow}>
          <Image source={ICON} style={styles.wmIcon} />
          <Text style={styles.wmText}>
            Chord <Text style={{ color: '#c9a6ff' }}>Palette</Text>
          </Text>
        </View>
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
                  <LinearGradient colors={primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.durActive}>
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

      {/* actions */}
      <View style={{ flexDirection: 'row', gap: 11, marginTop: 2 }}>
        <Pressable style={styles.saveBtn}>
          <Icon name="download" size={17} color={colors.textPrimary} strokeWidth={2.2} />
          <Text style={styles.saveBtnText}>写真に保存</Text>
        </Pressable>
        <Pressable style={{ flex: 1 }}>
          <LinearGradient colors={primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shareBtn}>
            <Icon name="share" size={17} color="#fff" strokeWidth={2.2} />
            <Text style={styles.shareBtnText}>共有</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </ScreenScaffold>
  );
}

function EqBars() {
  return (
    <View style={styles.eqRow}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <EqBar key={i} index={i} />
      ))}
    </View>
  );
}

function EqBar({ index }: { index: number }) {
  const h = 12 + Math.round((Math.sin(index * 0.9) * 0.5 + 0.5) * 46 + (index % 3) * 6);
  const color = rainbowFull[index % rainbowFull.length];
  const scale = useSharedValue(0.35);

  useEffect(() => {
    const dur = 800 + (index % 5) * 130;
    const delay = (index % 7) * 90;
    scale.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [index, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));

  return (
    <Animated.View
      style={[
        { width: 5, height: h, borderRadius: 3, backgroundColor: color, transformOrigin: 'bottom' },
        animStyle,
      ]}
    />
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
    width: 214,
    height: 380,
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: radius['4xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderFaint,
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
  previewTop: { position: 'absolute', top: 22, left: 0, right: 0, alignItems: 'center' },
  previewTitle: { fontSize: 15, fontFamily: font.extrabold, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.3 },
  previewMeta: { fontSize: 10, color: colors.textMuted, marginTop: 3, fontFamily: font.semibold, fontWeight: '600' },
  previewCenter: { position: 'absolute', top: 96, left: 0, right: 0, alignItems: 'center' },
  bigChord: { fontSize: 58, fontFamily: font.black, fontWeight: '900', lineHeight: 60 },
  chordDesc: { fontSize: 10.5, color: colors.textSecondary, marginTop: 7, fontFamily: font.medium, fontWeight: '500' },

  eqRow: {
    position: 'absolute',
    bottom: 96,
    left: 16,
    right: 16,
    height: 70,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },

  strip: {
    position: 'absolute',
    bottom: 52,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stripChip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  stripText: { fontSize: 10, fontFamily: font.bold, fontWeight: '700' },
  stripArrow: { color: '#556', fontSize: 9 },

  watermarkRow: {
    position: 'absolute',
    bottom: 16,
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

  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius['2xl'],
    paddingVertical: 15,
  },
  saveBtnText: { fontSize: 14, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },
  shareBtn: {
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
  shareBtnText: { fontSize: 14, fontFamily: font.bold, fontWeight: '700', color: '#fff' },
});

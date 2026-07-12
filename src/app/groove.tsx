import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Chip, ChipRow, SectionTitle, VolumeSlider } from '@/components/controls';
import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import {
  ACCOMPANIMENT_IDS,
  ACCOMPANIMENT_LABELS,
  FREE_INSTRUMENTS,
  GROOVE_IDS,
  GROOVE_LABELS,
  INSTRUMENT_LABELS,
  PRO_INSTRUMENTS,
} from '@/data/labels';
import * as session from '@/features/editor/session';
import { useEditorSession } from '@/features/editor/session';
import { useEntitlements } from '@/services/billing';
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
  const ent = useEntitlements();
  const [playing, setPlaying] = useState(false);

  const selectInstrument = (id: InstrumentId, pro: boolean) => {
    if (pro && !ent.palettePro) {
      router.push('/paywall');
      return;
    }
    session.setInstrument(id);
  };

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
        <Pressable onPress={() => setPlaying((p) => !p)}>
          <LinearGradient
            colors={primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bigPlay, playing && styles.bigPlayActive]}>
            <Icon name="play" size={27} color="#fff" />
          </LinearGradient>
        </Pressable>
        <Icon name="skipForward" size={22} color={colors.textMuted} strokeWidth={2.2} />
      </View>

      {/* 音色 */}
      <SectionTitle>音色</SectionTitle>
      <ChipRow
        options={FREE_INSTRUMENTS.map((id) => ({ key: id, label: INSTRUMENT_LABELS[id] }))}
        value={s.instrumentId}
        onChange={(k) => selectInstrument(k as InstrumentId, false)}
        style={{ marginBottom: 9 }}
        chipStyle={{ paddingVertical: 12 }}
      />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
        {PRO_INSTRUMENTS.map((id) => {
          const unlocked = ent.palettePro;
          return (
            <Chip
              key={id}
              label={INSTRUMENT_LABELS[id]}
              locked={!unlocked}
              active={unlocked && s.instrumentId === id}
              onPress={() => selectInstrument(id, true)}
              style={{ flex: 1, paddingVertical: 12 }}
              textStyle={{ fontSize: 12 }}
            />
          );
        })}
      </View>

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

      {/* 音量（Phase 2 の音声エンジンで有効化） */}
      <View style={styles.volPanel}>
        <VolumeSlider label="コード音" percent={70} />
        <VolumeSlider label="ドラム" percent={90} />
      </View>

      {/* Pro upsell */}
      {!ent.palettePro && (
        <Pressable style={styles.upsell} onPress={() => router.push('/paywall')}>
          <LinearGradient
            colors={['#7c4dff', '#d6409f']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.upsellIcon}>
            <Icon name="lock" size={18} color="#fff" strokeWidth={2.2} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.upsellTitle}>音色をもっと増やす</Text>
            <Text style={styles.upsellSub}>Palette Proでギター・ストリングスを解放</Text>
          </View>
          <Icon name="chevronRight" size={16} color={colors.purpleText} strokeWidth={2.4} />
        </Pressable>
      )}
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

  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: rgba('#7c5cff', 0.14),
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.35)',
    borderRadius: radius['2xl'],
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  upsellIcon: { width: 38, height: 38, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  upsellTitle: { fontSize: 13.5, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },
  upsellSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});

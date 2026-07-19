import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { PRESETS } from '@/data/presets';
import * as session from '@/features/editor/session';
import { useEntitlements } from '@/services/billing';
import { colors, font, primaryGradient, radius } from '@/theme/tokens';
import type { Preset } from '@/types';

const TAG_TEXT: Record<string, string> = {
  '#eab308': '#e6c34a',
  '#d6409f': '#c99ad8',
  '#3b82f6': '#8fb6f2',
  '#ef4444': '#f0918f',
  '#8b5cf6': '#b9a6ff',
  '#22c55e': '#7fd99b',
};

function tagColors(accent: string) {
  const text = TAG_TEXT[accent] ?? colors.textMuted;
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  return { text, bg: `rgba(${r},${g},${b},0.14)` };
}

export default function PresetsScreen() {
  const router = useRouter();
  const ent = useEntitlements();
  const [tab, setTab] = useState<'free' | 'pro'>('pro');
  const free = PRESETS.filter((p) => p.category === 'free');
  const pro = PRESETS.filter((p) => p.category === 'pro');

  const applyPreset = (preset: Preset) => {
    session.startFromPreset(preset);
    router.replace('/editor');
  };

  const openProPreset = (preset: Preset) => {
    if (ent.palettePro) applyPreset(preset);
    else router.push('/paywall');
  };

  return (
    <ScreenScaffold>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevronLeft" size={17} color={colors.textSecondary} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>進行プリセット</Text>
      </View>

      {/* Free / Pro tab */}
      <View style={styles.tabTrack}>
        <Pressable style={styles.tabItem} onPress={() => setTab('free')}>
          {tab === 'free' ? (
            <LinearGradient colors={primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tabActive}>
              <Text style={styles.tabTextActive}>無料</Text>
            </LinearGradient>
          ) : (
            <Text style={styles.tabText}>無料</Text>
          )}
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => setTab('pro')}>
          {tab === 'pro' ? (
            <LinearGradient colors={primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tabActive}>
              <Text style={styles.tabTextActive}>Palette Pro</Text>
              <Icon name={ent.palettePro ? 'check' : 'lock'} size={12} color="#fff" strokeWidth={2.4} />
            </LinearGradient>
          ) : (
            <View style={styles.tabInactiveRow}>
              <Text style={styles.tabText}>Palette Pro</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Free section */}
      <Text style={styles.sectionLabel}>無料</Text>
      {free.map((p) => (
        <FreePresetCard key={p.id} preset={p} onPress={() => applyPreset(p)} />
      ))}

      {/* Pro section */}
      <View style={styles.proHeader}>
        <Text style={styles.proHeaderText}>Palette Pro</Text>
        {ent.palettePro ? (
          <>
            <Icon name="check" size={12} color={colors.success} strokeWidth={2.6} />
            <Text style={styles.unlockedTag}>解放済み</Text>
          </>
        ) : (
          <Icon name="lock" size={12} color={colors.purpleText} strokeWidth={2.4} />
        )}
      </View>
      <View style={{ gap: 11 }}>
        {pro.map((p) => (
          <ProPresetCard key={p.id} preset={p} unlocked={ent.palettePro} onPress={() => openProPreset(p)} />
        ))}
      </View>

      <Text style={styles.footer}>選ぶと編集画面に読み込まれ、{'\n'}自由に編集できます。</Text>
    </ScreenScaffold>
  );
}

function FreePresetCard({ preset, onPress }: { preset: Preset; onPress: () => void }) {
  const tc = tagColors(preset.accent);
  return (
    <Pressable onPress={onPress} style={styles.freeCard}>
      <View style={[styles.stripe, { backgroundColor: preset.accent }]} />
      <Text style={styles.freeName}>{preset.name}</Text>
      <Text style={styles.freeChords}>{preset.chordsDisplay}</Text>
      <View style={{ flexDirection: 'row', gap: 7 }}>
        {preset.tags.map((t) => (
          <View key={t} style={[styles.freeTag, { backgroundColor: tc.bg }]}>
            <Text style={[styles.freeTagText, { color: tc.text }]}>{t}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function ProPresetCard({ preset, unlocked, onPress }: { preset: Preset; unlocked: boolean; onPress: () => void }) {
  const tc = tagColors(preset.accent);
  return (
    <Pressable onPress={onPress} style={styles.proCard}>
      <View style={[styles.stripe, { backgroundColor: preset.accent }]} />
      <View style={styles.proTopRow}>
        <Text style={styles.proName}>{preset.name}</Text>
        <Icon
          name={unlocked ? 'check' : 'lock'}
          size={15}
          color={unlocked ? colors.success : colors.gold}
          strokeWidth={2.2}
        />
      </View>
      <Text style={styles.proChords}>{preset.chordsDisplay}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {preset.tags.map((t) => (
          <View key={t} style={[styles.proTag, { backgroundColor: tc.bg }]}>
            <Text style={[styles.proTagText, { color: tc.text }]}>{t}</Text>
          </View>
        ))}
      </View>
    </Pressable>
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

  tabTrack: { flexDirection: 'row', gap: 4, backgroundColor: colors.surfaceInput, borderRadius: 13, padding: 4, marginBottom: 20 },
  tabItem: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
  tabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  tabInactiveRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  tabText: { fontSize: 13.5, fontFamily: font.semibold, fontWeight: '600', color: colors.textMuted, textAlign: 'center', paddingVertical: 10 },
  tabTextActive: { fontSize: 13.5, fontFamily: font.bold, fontWeight: '700', color: colors.white },

  sectionLabel: { fontSize: 12, fontFamily: font.bold, fontWeight: '700', color: colors.textDim, marginBottom: 10, marginHorizontal: 2 },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },

  freeCard: {
    position: 'relative',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius['3xl'],
    paddingVertical: 16,
    paddingHorizontal: 18,
    overflow: 'hidden',
    marginBottom: 22,
  },
  freeName: { fontSize: 17, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  freeChords: { fontSize: 14, color: colors.textSecondary, letterSpacing: 0.6, marginBottom: 13 },
  freeTag: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8 },
  freeTagText: { fontSize: 11, fontFamily: font.semibold, fontWeight: '600' },

  proHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginHorizontal: 2 },
  proHeaderText: { fontSize: 12, fontFamily: font.bold, fontWeight: '700', color: colors.purpleText },
  unlockedTag: { fontSize: 10.5, fontFamily: font.bold, fontWeight: '700', color: colors.successText, letterSpacing: 0.3 },
  proCard: {
    position: 'relative',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius['2xl'],
    paddingVertical: 15,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  proTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  proName: { fontSize: 15.5, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },
  proChords: { fontSize: 12.5, color: colors.textMuted, letterSpacing: 0.4, marginBottom: 10 },
  proTag: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 7 },
  proTagText: { fontSize: 10.5, fontFamily: font.semibold, fontWeight: '600' },

  footer: { textAlign: 'center', fontSize: 11.5, color: colors.textFaint, marginTop: 18, lineHeight: 18 },
});

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { UpsellToast, useUpsellToast } from '@/components/UpsellToast';
import { PRESETS } from '@/data/presets';
import { loadAdminMode, useAdminMode } from '@/features/admin/adminMode';
import { presetPlaybackRequest } from '@/features/editor/playback';
import * as session from '@/features/editor/session';
import { presetsToTsSource } from '@/lib/adminPreset';
import { deleteUserPreset, listUserPresets } from '@/repositories/presetRepository';
import { track } from '@/services/analytics';
import { audioService } from '@/services/audio';
import { useEntitlements } from '@/services/billing';
import { colors, font, radius } from '@/theme/tokens';
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
  const isAdmin = useAdminMode();
  const upsell = useUpsellToast();
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [exportOpen, setExportOpen] = useState(false);

  const reloadUserPresets = useCallback(() => {
    listUserPresets()
      .then(setUserPresets)
      .catch(() => setUserPresets([]));
  }, []);

  useEffect(() => {
    loadAdminMode();
  }, []);

  // Refresh whenever the screen regains focus (e.g. after authoring a preset).
  // On blur, stop any in-progress preview audition so it doesn't outlive the screen.
  useFocusEffect(
    useCallback(() => {
      reloadUserPresets();
      return () => {
        audioService.stop().catch(() => undefined);
      };
    }, [reloadUserPresets]),
  );

  const userIds = new Set(userPresets.map((p) => p.id));
  const all = [...userPresets, ...PRESETS];
  const free = all.filter((p) => p.category === 'free');
  const pro = all.filter((p) => p.category === 'pro');

  const applyPreset = (preset: Preset) => {
    track('preset_selected', { category: preset.category, chords: preset.chords.length });
    session.startFromPreset(preset);
    router.replace('/editor');
  };

  const openProPreset = (preset: Preset) => {
    if (ent.palettePro) {
      applyPreset(preset);
      return;
    }
    // Preview-only (試聴) for free users: audition the whole progression with the
    // current groove / accompaniment, but do NOT load it into the editor (引用・編集
    // is Palette Pro). A non-blocking toast keeps the upgrade path one tap away.
    track('preset_selected', { category: preset.category, chords: preset.chords.length });
    audioService
      .play(presetPlaybackRequest(preset, session.getSession(), false, ent.palettePro ? 'pro' : 'free'))
      .catch(() => undefined);
    upsell.show('このプリセットは Palette Pro。無料版は試聴のみ可能です');
  };

  const onDelete = async (id: string) => {
    await deleteUserPreset(id);
    reloadUserPresets();
  };

  const isEmpty = all.length === 0;

  return (
    <View style={styles.screenRoot}>
    <ScreenScaffold>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevronLeft" size={17} color={colors.textSecondary} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>進行プリセット</Text>
      </View>

      {isAdmin ? (
        <View style={styles.adminBanner}>
          <Icon name="bookmark" size={13} color={colors.purpleText} strokeWidth={2.4} />
          <Text style={styles.adminBannerText}>
            管理者モード — 進行はエディタの登録ボタンから追加
          </Text>
          {userPresets.length > 0 ? (
            <Pressable style={styles.exportChip} onPress={() => setExportOpen(true)} hitSlop={6}>
              <Icon name="share" size={12} color={colors.white} strokeWidth={2.4} />
              <Text style={styles.exportChipText}>書き出し({userPresets.length})</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isEmpty ? (
        <EmptyState
          title="プリセットはまだありません"
          hint={'New presets, curated by Chord Palette.\nAdded regularly — stay tuned.'}
        />
      ) : (
        <>
          {/* Free section */}
          {free.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>無料</Text>
              {free.map((p) => (
                <FreePresetCard
                  key={p.id}
                  preset={p}
                  onPress={() => applyPreset(p)}
                  onDelete={isAdmin && userIds.has(p.id) ? () => onDelete(p.id) : undefined}
                />
              ))}
            </>
          ) : null}

          {/* Pro section */}
          {pro.length > 0 ? (
            <>
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
                  <ProPresetCard
                    key={p.id}
                    preset={p}
                    unlocked={ent.palettePro}
                    onPress={() => openProPreset(p)}
                    onDelete={isAdmin && userIds.has(p.id) ? () => onDelete(p.id) : undefined}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.footer}>選ぶと編集画面に読み込まれ、{'\n'}自由に編集できます。</Text>
        </>
      )}

      <ExportModal
        open={exportOpen}
        presets={userPresets}
        onClose={() => setExportOpen(false)}
      />
    </ScreenScaffold>
      <UpsellToast message={upsell.message} onPress={() => router.push('/paywall')} />
    </View>
  );
}

function ExportModal({
  open,
  presets,
  onClose,
}: {
  open: boolean;
  presets: Preset[];
  onClose: () => void;
}) {
  const ts = presets.length > 0 ? presetsToTsSource(presets) : '';
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>配信用コード書き出し</Text>
          <Text style={styles.modalHint}>
            長押し → すべてを選択 でコピーし、src/data/presets.ts の PRESETS 配列に貼り付けてください。
          </Text>
          <View style={styles.codeBox}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <TextInput
                value={ts}
                editable={false}
                multiline
                scrollEnabled
                selectTextOnFocus
                style={styles.codeText}
              />
            </ScrollView>
          </View>
          <Pressable style={styles.modalCloseBtn} onPress={onClose}>
            <Text style={styles.modalCloseText}>閉じる</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FreePresetCard({ preset, onPress, onDelete }: { preset: Preset; onPress: () => void; onDelete?: () => void }) {
  const tc = tagColors(preset.accent);
  return (
    <Pressable onPress={onPress} style={styles.freeCard}>
      <View style={[styles.stripe, { backgroundColor: preset.accent }]} />
      <View style={styles.cardTopRow}>
        <Text style={styles.freeName}>{preset.name}</Text>
        {onDelete ? <DeleteBtn onPress={onDelete} /> : null}
      </View>
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

function ProPresetCard({ preset, unlocked, onPress, onDelete }: { preset: Preset; unlocked: boolean; onPress: () => void; onDelete?: () => void }) {
  const tc = tagColors(preset.accent);
  return (
    <Pressable onPress={onPress} style={styles.proCard}>
      <View style={[styles.stripe, { backgroundColor: preset.accent }]} />
      <View style={styles.proTopRow}>
        <Text style={styles.proName}>{preset.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onDelete ? <DeleteBtn onPress={onDelete} /> : null}
          <Icon
            name={unlocked ? 'check' : 'lock'}
            size={15}
            color={unlocked ? colors.success : colors.gold}
            strokeWidth={2.2}
          />
        </View>
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

function DeleteBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
      hitSlop={8}
      style={styles.deleteBtn}>
      <Icon name="trash" size={14} color={colors.textFaint} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
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

  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceInput,
  },

  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(124,92,255,0.12)',
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  adminBannerText: { flex: 1, fontSize: 11.5, fontFamily: font.semibold, fontWeight: '600', color: colors.purpleText },
  exportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  exportChipText: { fontSize: 11.5, fontFamily: font.bold, fontWeight: '700', color: colors.white },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalSheet: {
    width: '100%',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius['2xl'],
    padding: 18,
  },
  modalTitle: { fontSize: 16, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  modalHint: { fontSize: 11.5, color: colors.textFaint, marginBottom: 12, lineHeight: 17 },
  codeBox: {
    backgroundColor: '#0a0f1a',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: 12,
    maxHeight: 300,
    marginBottom: 14,
  },
  codeText: { fontSize: 11, color: '#c7d2e5', fontFamily: 'Menlo', minWidth: 320 },
  modalCloseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: 13,
  },
  modalCloseText: { fontSize: 14, fontFamily: font.bold, fontWeight: '700', color: colors.white },
});

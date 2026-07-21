import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SegTrack } from '@/components/controls';
import { useEditorSession } from '@/features/editor/session';
import {
  PRESET_ACCENTS,
  buildPresetFromDraft,
  chordsDisplayFor,
  parseTags,
  presetToTsSource,
} from '@/lib/adminPreset';
import { saveUserPreset } from '@/repositories/presetRepository';
import { colors, font, radius } from '@/theme/tokens';
import type { Preset, PresetCategory } from '@/types';

const CATEGORY_OPTIONS = [
  { key: 'free', label: '無料' },
  { key: 'pro', label: 'Palette Pro' },
];

/**
 * Admin-only preset authoring screen. Turns the current editor progression into a
 * degree-based preset, saves it locally (previewable immediately on the presets
 * screen) and shows a copy-paste-ready TS block for shipping to all users.
 */
export default function AdminPresetScreen() {
  const router = useRouter();
  const session = useEditorSession();

  const [name, setName] = useState(session.title || '無題の進行');
  const [category, setCategory] = useState<PresetCategory>('free');
  const [tagsText, setTagsText] = useState('');
  const [accent, setAccent] = useState<string>(PRESET_ACCENTS[0]);
  const [saved, setSaved] = useState<Preset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const events = session.progression;
  const chordsDisplay = useMemo(() => chordsDisplayFor(events), [events]);

  const onSave = async () => {
    if (events.length === 0) {
      setError('登録するコードがありません。エディタで進行を作成してください。');
      return;
    }
    const preset = buildPresetFromDraft({
      name,
      category,
      tags: parseTags(tagsText),
      accent,
      events,
    });
    try {
      await saveUserPreset(preset);
      setSaved(preset);
    } catch (e) {
      setError(`保存に失敗しました: ${String(e)}`);
    }
  };

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevronLeft" size={17} color={colors.textSecondary} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>プリセットに登録</Text>
      </View>

      {saved ? (
        <SavedView preset={saved} onList={() => router.replace('/presets')} onBack={() => router.back()} />
      ) : (
        <>
          {/* Preview */}
          <View style={[styles.previewCard, { borderColor: accent }]}>
            <View style={[styles.stripe, { backgroundColor: accent }]} />
            <Text style={styles.previewKey}>{session.key} Major · {events.length}コード</Text>
            <Text style={styles.previewChords}>{chordsDisplay || '（コードがありません）'}</Text>
          </View>

          {/* Name */}
          <Text style={styles.label}>名前</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="進行の名前"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={40}
            returnKeyType="done"
          />

          {/* Category */}
          <Text style={styles.label}>カテゴリ</Text>
          <SegTrack
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(k) => setCategory(k as PresetCategory)}
            style={styles.categorySeg}
          />

          {/* Tags */}
          <Text style={styles.label}>タグ（カンマ区切り・最大4つ）</Text>
          <TextInput
            value={tagsText}
            onChangeText={setTagsText}
            placeholder="例: 明るい, 王道, サビ向き"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={60}
            returnKeyType="done"
          />

          {/* Accent */}
          <Text style={styles.label}>アクセントカラー</Text>
          <View style={styles.swatchRow}>
            {PRESET_ACCENTS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setAccent(c)}
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  accent === c && styles.swatchActive,
                ]}>
                {accent === c ? (
                  <Icon name="check" size={14} color={colors.white} strokeWidth={3} />
                ) : null}
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.saveBtn} onPress={onSave}>
            <Icon name="bookmark" size={16} color={colors.white} strokeWidth={2.4} />
            <Text style={styles.saveBtnText}>この進行をプリセットに登録</Text>
          </Pressable>

          <Text style={styles.footnote}>
            登録後、プリセット一覧に表示されます。全ユーザーへ配信するには、書き出したコードを
            {' '}src/data/presets.ts{' '}に貼り付けて次回ビルドしてください。
          </Text>
        </>
      )}
    </ScreenScaffold>
  );
}

function SavedView({
  preset,
  onList,
  onBack,
}: {
  preset: Preset;
  onList: () => void;
  onBack: () => void;
}) {
  const ts = useMemo(() => presetToTsSource(preset), [preset]);
  return (
    <>
      <View style={styles.savedBanner}>
        <Icon name="check" size={16} color={colors.successText} strokeWidth={2.8} />
        <Text style={styles.savedText}>「{preset.name}」を登録しました</Text>
      </View>

      <Text style={styles.label}>配信用コード（src/data/presets.ts に貼り付け）</Text>
      <Text style={styles.exportHint}>
        長押し → すべてを選択 でコピーし、PRESETS 配列に追加してください。
      </Text>
      <View style={styles.codeBox}>
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ maxHeight: 260 }}>
          <TextInput
            value={ts}
            editable={false}
            multiline
            scrollEnabled={false}
            selectTextOnFocus
            style={styles.codeText}
          />
        </ScrollView>
      </View>

      <Pressable style={styles.saveBtn} onPress={onList}>
        <Text style={styles.saveBtnText}>プリセット一覧を見る</Text>
      </Pressable>
      <Pressable style={styles.ghostBtn} onPress={onBack}>
        <Text style={styles.ghostBtnText}>エディタに戻る</Text>
      </Pressable>
    </>
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

  previewCard: {
    position: 'relative',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: 15,
    paddingHorizontal: 18,
    overflow: 'hidden',
    marginBottom: 22,
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  previewKey: { fontSize: 11.5, fontFamily: font.semibold, fontWeight: '600', color: colors.textFaint, marginBottom: 6 },
  previewChords: { fontSize: 15, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.6 },

  label: { fontSize: 12, fontFamily: font.bold, fontWeight: '700', color: colors.textDim, marginBottom: 8, marginTop: 4, marginHorizontal: 2 },
  input: {
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  categorySeg: { flex: 0, marginBottom: 16 },

  swatchRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: { borderColor: colors.white },

  error: { fontSize: 12.5, color: '#f0918f', marginBottom: 12, marginHorizontal: 2 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: 15,
    marginTop: 4,
  },
  saveBtnText: { fontSize: 15, fontFamily: font.bold, fontWeight: '700', color: colors.white },
  ghostBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 6 },
  ghostBtnText: { fontSize: 13.5, fontFamily: font.semibold, fontWeight: '600', color: colors.textMuted },

  footnote: { fontSize: 11.5, color: colors.textFaint, marginTop: 16, lineHeight: 18, marginHorizontal: 2 },

  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  savedText: { fontSize: 14, fontFamily: font.bold, fontWeight: '700', color: colors.successText },
  exportHint: { fontSize: 11.5, color: colors.textFaint, marginBottom: 8, marginHorizontal: 2 },
  codeBox: {
    backgroundColor: '#0a0f1a',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 20,
  },
  codeText: {
    fontSize: 11,
    color: '#c7d2e5',
    fontFamily: 'Menlo',
    minWidth: 320,
  },
});

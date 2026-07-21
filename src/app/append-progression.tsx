import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { PRESETS } from '@/data/presets';
import * as session from '@/features/editor/session';
import type { AppendOutcome } from '@/features/editor/session';
import { useEditorSession } from '@/features/editor/session';
import { MAX_BARS, totalBars } from '@/lib/progression';
import { accentFor, chordsDisplay } from '@/lib/projectSummary';
import { listUserPresets } from '@/repositories/presetRepository';
import { listProjects } from '@/repositories/projectRepository';
import { track } from '@/services/analytics';
import { colors, font, radius } from '@/theme/tokens';
import type { Preset, Project } from '@/types';

/** Bars as a compact string (drops a trailing ".0"). */
function fmtBars(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Recall a stored progression and append it to the tail of the current editor
 * session. Lists both saved projects (appended at absolute pitch) and presets
 * (rendered in the current key). Respects the 16-bar cap — overflow is dropped and
 * reported. The editor session updates reactively, so returning shows the result.
 */
export default function AppendProgressionScreen() {
  const router = useRouter();
  const s = useEditorSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      listProjects()
        .then(setProjects)
        .catch(() => setProjects([]));
      listUserPresets()
        .then(setUserPresets)
        .catch(() => setUserPresets([]));
    }, []),
  );

  const usedBars = totalBars(s.progression);
  const remainingBars = Math.max(0, MAX_BARS - usedBars);
  const full = remainingBars <= 0;

  const flash = (o: AppendOutcome) => {
    if (o.appended === 0) {
      setToast('16小節の上限に達しているため追加できませんでした');
    } else if (o.dropped > 0) {
      setToast(`${o.appended}個を追加しました（${o.dropped}個は16小節の上限で省略）`);
    } else {
      setToast(`${o.appended}個のコードを末尾に追加しました`);
    }
    setTimeout(() => setToast(null), 2400);
  };

  const presets = [...userPresets, ...PRESETS];
  const isEmpty = projects.length === 0 && presets.length === 0;

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevronLeft" size={17} color={colors.textSecondary} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>進行を追加</Text>
      </View>

      <View style={styles.capBar}>
        <Text style={styles.capText}>
          追加先：{s.key} Major · 残り{' '}
          <Text style={full ? styles.capFull : styles.capOk}>{fmtBars(remainingBars)}小節</Text>
        </Text>
      </View>

      {toast ? (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <Icon name="check" size={13} color={colors.successText} strokeWidth={2.6} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {full ? (
        <Text style={styles.fullHint}>
          現在の進行が16小節に達しています。追加するには、いくつかコードを削除してください。
        </Text>
      ) : null}

      {isEmpty ? (
        <Text style={styles.emptyHint}>
          追加できる保存済みの進行やプリセットがまだありません。
        </Text>
      ) : (
        <>
          {projects.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>保存した進行</Text>
              {projects.map((p) => (
                <RecallCard
                  key={p.id}
                  accent={accentFor(p.id)}
                  name={p.title}
                  chords={chordsDisplay(p)}
                  meta={`${p.key} Major · ${fmtBars(totalBars(p.chordEvents))}小節`}
                  disabled={full}
                  onPress={() => flash(session.appendProject(p))}
                />
              ))}
            </>
          ) : null}

          {presets.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>プリセット</Text>
              {presets.map((p) => (
                <RecallCard
                  key={p.id}
                  accent={p.accent}
                  name={p.name}
                  chords={p.chordsDisplay}
                  meta={`${p.chords.length}コード${p.category === 'pro' ? ' · Pro' : ''}`}
                      disabled={full}
                      onPress={() => {
                        track('preset_selected', { category: p.category, chords: p.chords.length });
                        flash(session.appendPreset(p));
                      }}
                />
              ))}
            </>
          ) : null}
        </>
      )}

      <Text style={styles.footer}>
        選んだ進行は、編集中の進行の末尾にそのままの響きで追加されます。
      </Text>
    </ScreenScaffold>
  );
}

function RecallCard({
  accent,
  name,
  chords,
  meta,
  disabled,
  onPress,
}: {
  accent: string;
  name: string;
  chords: string;
  meta: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.card, disabled && styles.cardDisabled]}
      accessibilityRole="button"
      accessibilityLabel={`${name} を末尾に追加`}>
      <View style={[styles.stripe, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.cardChords} numberOfLines={1}>
          {chords}
        </Text>
        <Text style={styles.cardMeta}>{meta}</Text>
      </View>
      <View style={[styles.addBadge, { borderColor: accent }]}>
        <Icon name="plus" size={16} color={accent} strokeWidth={2.6} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingBottom: 14 },
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

  capBar: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  capText: { fontSize: 12.5, fontFamily: font.semibold, fontWeight: '600', color: colors.textSecondary },
  capOk: { color: colors.textPrimary, fontFamily: font.bold, fontWeight: '700' },
  capFull: { color: colors.gold, fontFamily: font.bold, fontWeight: '700' },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  toastText: { flex: 1, fontSize: 12, fontFamily: font.semibold, fontWeight: '600', color: colors.successText },

  fullHint: { fontSize: 12, color: colors.textFaint, lineHeight: 18, marginBottom: 14 },
  emptyHint: { fontSize: 13, color: colors.textDim, lineHeight: 20, marginTop: 20, textAlign: 'center' },

  sectionLabel: {
    fontSize: 12,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textDim,
    marginBottom: 10,
    marginTop: 6,
    marginHorizontal: 2,
  },

  card: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius['2xl'],
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardDisabled: { opacity: 0.4 },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 16, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary, marginBottom: 5 },
  cardChords: { fontSize: 13, color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 5 },
  cardMeta: { fontSize: 11, color: colors.textFaint, fontFamily: font.semibold, fontWeight: '600' },
  addBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: { textAlign: 'center', fontSize: 11.5, color: colors.textFaint, marginTop: 16, lineHeight: 18 },
});

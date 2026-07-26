import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { MetaPill } from '@/components/controls';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { UpsellToast, useUpsellToast } from '@/components/UpsellToast';
import { Wordmark } from '@/components/Wordmark';
import { loadAdminMode, setAdminMode, toggleAdminMode, useAdminMode } from '@/features/admin/adminMode';
import { startNew } from '@/features/editor/session';
import { saveAllowance, saveLimitMessage } from '@/features/projects/saveLimit';
import { logger } from '@/lib/logger';
import { toSummary } from '@/lib/projectSummary';
import { deleteProject, duplicateProject, listProjects } from '@/repositories/projectRepository';
import { track } from '@/services/analytics';
import { useEntitlements } from '@/services/billing';
import { colors, font, radius } from '@/theme/tokens';
import type { Project, ProjectSummary } from '@/types';

export default function ProjectListScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const isAdmin = useAdminMode();
  const [adminToast, setAdminToast] = useState<string | null>(null);
  const ent = useEntitlements();
  const upsell = useUpsellToast();

  useEffect(() => {
    loadAdminMode();
  }, []);

  const flashToast = (msg: string) => {
    setAdminToast(msg);
    setTimeout(() => setAdminToast(null), 1800);
  };

  // Hidden owner entry: tap the wordmark 7× in quick succession (each tap must
  // land within 1.2s of the previous) to toggle admin mode. No visible control,
  // so casual users won't discover it; the owner just knows the gesture.
  const secretTap = useRef<{ count: number; timer: ReturnType<typeof setTimeout> | null }>({
    count: 0,
    timer: null,
  });
  const onSecretTap = () => {
    const s = secretTap.current;
    s.count += 1;
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      s.count = 0;
      s.timer = null;
    }, 1200);
    if (s.count >= 7) {
      s.count = 0;
      if (s.timer) clearTimeout(s.timer);
      s.timer = null;
      toggleAdminMode()
        .then((now) => flashToast(now ? '管理者モード ON' : '管理者モード OFF'))
        .catch((e) => logger.error('Admin toggle failed', { error: String(e) }));
    }
  };

  // Visible only while admin is ON — a one-tap exit (entry stays hidden).
  const leaveAdmin = () => {
    setAdminMode(false)
      .then(() => flashToast('管理者モード OFF'))
      .catch((e) => logger.error('Admin off failed', { error: String(e) }));
  };

  const refresh = useCallback(() => {
    listProjects()
      .then(setProjects)
      .catch((e) => {
        logger.error('Failed to load projects', { error: String(e) });
        setProjects([]);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  /**
   * Checks the free save limit before anything is written. Asking here rather than
   * at persist time means a player is told they are out of slots while the canvas
   * is still blank, instead of after they have built something.
   */
  const withSaveSlot = async (run: () => void) => {
    const allowance = await saveAllowance(ent);
    if (!allowance.canCreate) {
      upsell.show(saveLimitMessage(allowance.limit));
      return;
    }
    run();
  };

  const createNew = () => {
    withSaveSlot(() => {
      track('project_created');
      startNew();
      router.push('/editor');
    }).catch((e) => logger.error('Failed to check the save limit', { error: String(e) }));
  };

  const confirmDelete = (project: Project) => {
    Alert.alert('プロジェクトを削除', `「${project.title}」を削除しますか？この操作は取り消せません。`, [
      {
        text: '削除',
        style: 'destructive',
        onPress: () =>
          deleteProject(project.id)
            .then(refresh)
            .catch((e) => logger.error('Failed to delete project', { error: String(e) })),
      },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  const confirmActions = (project: Project) => {
    Alert.alert(project.title, undefined, [
      {
        text: '複製',
        onPress: () =>
          withSaveSlot(() => {
            duplicateProject(project.id)
              .then(refresh)
              .catch((e) => logger.error('Failed to duplicate project', { error: String(e) }));
          }).catch((e) => logger.error('Failed to check the save limit', { error: String(e) })),
      },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => confirmDelete(project),
      },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  const summaries: ProjectSummary[] = (projects ?? []).map((p) => toSummary(p));

  return (
    <View style={styles.screenRoot}>
    <ScreenScaffold>
      <View style={styles.header}>
        <Pressable onPress={onSecretTap} hitSlop={6} accessibilityRole="image">
          <Wordmark size={22} withIcon iconSize={38} />
        </Pressable>
        {isAdmin ? (
          <Pressable
            style={[styles.iconBtn, styles.iconBtnAdmin]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="管理者モードを解除"
            onPress={leaveAdmin}>
            <Icon name="gear" size={19} color={colors.purpleText} strokeWidth={1.9} />
            <View style={styles.adminDot} />
          </Pressable>
        ) : null}
      </View>

      {adminToast ? (
        <View style={styles.adminToast} accessibilityLiveRegion="polite">
          <Icon name="check" size={13} color={colors.successText} strokeWidth={2.6} />
          <Text style={styles.adminToastText}>{adminToast}</Text>
        </View>
      ) : null}

      <Text style={styles.heroHint}>コードを並べて、すぐに鳴らす</Text>
      <PrimaryButton label="新しい進行を作る" icon="plus" onPress={createNew} />

      <Pressable onPress={() => router.push('/presets')} style={styles.presetLink} hitSlop={6}>
        <Icon name="dots" size={15} color={colors.purpleSoft} strokeWidth={2} />
        <Text style={styles.presetLinkText}>プリセットから選ぶ</Text>
      </Pressable>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>メモリー</Text>
        <Text style={styles.listHeaderCount}>{summaries.length}件</Text>
      </View>

      {projects === null ? null : summaries.length === 0 ? (
        <EmptyState
          title="まだメモリーがありません"
          hint="上のボタンから曲を始め、下のコードをタップして再生まで30秒で体験できます"
        />
      ) : (
        <View style={{ gap: 12 }}>
          {summaries.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onPress={() => router.push(`/editor?id=${p.id}`)}
              onLongPress={() => {
                const full = projects.find((x) => x.id === p.id);
                if (full) confirmActions(full);
              }}
              onDelete={() => {
                const full = projects.find((x) => x.id === p.id);
                if (full) confirmDelete(full);
              }}
            />
          ))}
        </View>
      )}

    </ScreenScaffold>
      <UpsellToast message={upsell.message} onPress={() => router.push('/paywall')} />
    </View>
  );
}

function ProjectCard({
  project,
  onPress,
  onLongPress,
  onDelete,
}: {
  project: ProjectSummary;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.stripe, { backgroundColor: project.accent }]} />
      <View style={styles.cardTopRow}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
            {project.title}
          </Text>
          <Text style={styles.cardTime} numberOfLines={1}>
            {project.updatedLabel}
          </Text>
        </View>
        <Pressable
          onPress={onDelete}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="削除"
          accessibilityHint={`${project.title} を削除`}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}>
          <Icon name="trash" size={17} color={colors.textMuted} strokeWidth={2} />
        </Pressable>
      </View>
      <View style={styles.metaRow}>
        <MetaPill label={project.keyLabel} />
        <MetaPill label={`${project.tempoBpm} BPM`} />
        <MetaPill label={`${project.bars}小節`} />
      </View>
      <Text style={styles.cardChords} numberOfLines={2} ellipsizeMode="tail">
        {project.chordsDisplay}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingBottom: 18,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnAdmin: { borderColor: colors.purpleText, backgroundColor: 'rgba(124,92,255,0.14)' },
  adminDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.purpleText,
  },
  adminToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderRadius: radius.md,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginBottom: 12,
  },
  adminToastText: { fontSize: 12.5, fontFamily: font.bold, fontWeight: '700', color: colors.successText },

  heroHint: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textMuted,
    fontFamily: font.semibold,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },

  presetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    marginTop: 10,
  },
  presetLinkText: {
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.purpleSoft,
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  listHeaderTitle: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textHeading,
  },
  listHeaderCount: { fontSize: 12.5, lineHeight: 18, color: colors.textFaint },

  card: {
    position: 'relative',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['3xl'],
    paddingVertical: 16,
    paddingRight: 14,
    paddingLeft: 20,
    overflow: 'hidden',
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitleBlock: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: {
    fontSize: 16.5,
    lineHeight: 22,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    marginTop: -4,
    marginRight: -4,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  deleteBtnPressed: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardTime: { fontSize: 11.5, lineHeight: 16, color: colors.textFaint },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10, marginBottom: 12 },
  cardChords: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
});

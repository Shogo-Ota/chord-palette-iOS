import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { MetaPill } from '@/components/controls';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Wordmark } from '@/components/Wordmark';
import { startNew } from '@/features/editor/session';
import { logger } from '@/lib/logger';
import { toSummary } from '@/lib/projectSummary';
import { deleteProject, duplicateProject, listProjects } from '@/repositories/projectRepository';
import { colors, font, radius } from '@/theme/tokens';
import type { Project, ProjectSummary } from '@/types';

export default function ProjectListScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);

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

  const createNew = () => {
    startNew();
    router.push('/editor');
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
          duplicateProject(project.id)
            .then(refresh)
            .catch((e) => logger.error('Failed to duplicate project', { error: String(e) })),
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
    <ScreenScaffold>
      <View style={styles.header}>
        <Wordmark size={22} withIcon iconSize={38} />
        <Pressable style={styles.iconBtn} hitSlop={8}>
          <Icon name="gear" size={19} color={colors.textMuted} strokeWidth={1.9} />
        </Pressable>
      </View>

      <Pressable onPress={createNew} style={({ pressed }) => pressed && styles.pressed}>
        <LinearGradient
          colors={['#7c5cff', '#5b8cff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}>
          <Icon name="plus" size={21} color="#fff" strokeWidth={2.6} />
          <Text style={styles.ctaText}>新しい進行を作る</Text>
        </LinearGradient>
      </Pressable>

      <Pressable onPress={() => router.push('/presets')} style={styles.presetLink} hitSlop={6}>
        <Icon name="dots" size={15} color={colors.purpleSoft} strokeWidth={2} />
        <Text style={styles.presetLinkText}>プリセットから選ぶ</Text>
      </Pressable>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>最近のプロジェクト</Text>
        <Text style={styles.listHeaderCount}>{summaries.length}件</Text>
      </View>

      {projects === null ? null : summaries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>まだプロジェクトがありません</Text>
          <Text style={styles.emptyHint}>「新しい進行を作る」から始めましょう</Text>
        </View>
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
            />
          ))}
        </View>
      )}
    </ScreenScaffold>
  );
}

function ProjectCard({
  project,
  onPress,
  onLongPress,
}: {
  project: ProjectSummary;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.stripe, { backgroundColor: project.accent }]} />
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle}>{project.title}</Text>
        <Text style={styles.cardTime}>{project.updatedLabel}</Text>
      </View>
      <View style={styles.metaRow}>
        <MetaPill label={project.keyLabel} />
        <MetaPill label={`${project.tempoBpm} BPM`} />
        <MetaPill label={`${project.bars}小節`} />
      </View>
      <Text style={styles.cardChords}>{project.chordsDisplay}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  cta: {
    borderRadius: radius['3xl'],
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#7c5cff',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  ctaText: { color: '#fff', fontSize: 17, fontFamily: font.bold, fontWeight: '700' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },

  presetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    marginTop: 10,
  },
  presetLinkText: { fontSize: 13.5, fontFamily: font.semibold, fontWeight: '600', color: colors.purpleSoft },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  listHeaderTitle: { fontSize: 15, fontFamily: font.bold, fontWeight: '700', color: colors.textHeading },
  listHeaderCount: { fontSize: 12.5, color: colors.textFaint },

  empty: {
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    borderStyle: 'dashed',
    borderRadius: radius['3xl'],
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 14.5, fontFamily: font.bold, fontWeight: '700', color: colors.textSecondary },
  emptyHint: { fontSize: 12.5, color: colors.textFaint },

  card: {
    position: 'relative',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['3xl'],
    paddingVertical: 16,
    paddingRight: 16,
    paddingLeft: 20,
    overflow: 'hidden',
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16.5, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },
  cardTime: { fontSize: 11.5, color: colors.textFaint },
  metaRow: { flexDirection: 'row', gap: 7, marginTop: 10, marginBottom: 12 },
  cardChords: { fontSize: 13, color: colors.textMuted, letterSpacing: 0.4 },
});

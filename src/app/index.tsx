import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { MetaPill } from '@/components/controls';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Wordmark } from '@/components/Wordmark';
import { startNew } from '@/features/editor/session';
import { logger } from '@/lib/logger';
import { toSummary } from '@/lib/projectSummary';
import { deleteProject, duplicateProject, getProject, listProjects } from '@/repositories/projectRepository';
import { clearLastProjectId, getLastProjectId } from '@/repositories/sessionPrefsRepository';
import { colors, font, radius } from '@/theme/tokens';
import type { Project, ProjectSummary } from '@/types';

export default function ProjectListScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listProjects()
      .then(setProjects)
      .catch((e) => {
        logger.error('Failed to load projects', { error: String(e) });
        setProjects([]);
      });
    getLastProjectId()
      .then(async (id) => {
        if (!id) {
          setLastId(null);
          return;
        }
        const p = await getProject(id);
        if (p) setLastId(id);
        else {
          await clearLastProjectId();
          setLastId(null);
        }
      })
      .catch(() => setLastId(null));
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

  const resumeLast = () => {
    if (!lastId) return;
    router.push(`/editor?id=${lastId}`);
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
        <Pressable
          style={styles.iconBtn}
          hitSlop={8}
          onPress={() => {
            // DEV-only shortcut to the Phase 2A audio verification screen.
            if (__DEV__) router.push('/dev-audio');
          }}>
          <Icon name="gear" size={19} color={colors.textMuted} strokeWidth={1.9} />
        </Pressable>
      </View>

      <Text style={styles.heroHint}>コードを並べて、すぐに鳴らす</Text>
      {lastId ? (
        <PrimaryButton label="続きから編集" icon="play" onPress={resumeLast} />
      ) : null}
      <PrimaryButton label="新しい進行を作る" icon="plus" onPress={createNew} />

      <Pressable onPress={() => router.push('/presets')} style={styles.presetLink} hitSlop={6}>
        <Icon name="dots" size={15} color={colors.purpleSoft} strokeWidth={2} />
        <Text style={styles.presetLinkText}>プリセットから選ぶ</Text>
      </Pressable>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>最近のプロジェクト</Text>
        <Text style={styles.listHeaderCount}>{summaries.length}件</Text>
      </View>

      {projects === null ? null : summaries.length === 0 ? (
        <EmptyState
          title="まだプロジェクトがありません"
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
  heroHint: {
    fontSize: 13.5,
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

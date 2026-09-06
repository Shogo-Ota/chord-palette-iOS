import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, font, radius, spacing, typeSize } from '@/theme/tokens';

export type CPChordEvolutionLevel = {
  readonly level: 'original' | 'seventh' | 'tension' | 'reharm';
  readonly label: 'Original' | '7th' | 'Rich' | 'Reharm';
};

export type CPChordEvolutionCandidate = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly changedCount: number;
  readonly rationale?: string;
  readonly applyLocked: boolean;
  readonly applyLabel: '適用' | 'Proで適用';
};

export type CPChordEvolutionSheetProps = {
  readonly visible: boolean;
  readonly scopeLabel: 'このコード' | '進行全体';
  readonly activeLevel: 'original' | 'seventh' | 'tension' | 'reharm';
  readonly levels: readonly CPChordEvolutionLevel[];
  readonly originalSummary: string;
  readonly candidates: readonly CPChordEvolutionCandidate[];
  readonly emptyMessage?: string;
  readonly onRequestClose: () => void;
  readonly onSelectLevel: (level: 'original' | 'seventh' | 'tension' | 'reharm') => void;
  readonly onPreviewOriginal: () => void;
  readonly onPreviewCandidate: (candidateId: string) => void;
  readonly onApplyCandidate: (candidateId: string) => void;
};

function ActionButton({
  label,
  accessibilityLabel,
  primary,
  locked,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  primary?: boolean;
  locked?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.action,
        primary && styles.actionPrimary,
        locked && styles.actionLocked,
        pressed && styles.pressed,
      ]}>
      {locked ? <Icon name="lock" size={13} color={colors.gold} /> : null}
      <Text
        style={[
          styles.actionText,
          primary && styles.actionTextPrimary,
          locked && styles.actionTextLocked,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CPChordEvolutionSheet({
  visible,
  scopeLabel,
  activeLevel,
  levels,
  originalSummary,
  candidates,
  emptyMessage,
  onRequestClose,
  onSelectLevel,
  onPreviewOriginal,
  onPreviewCandidate,
  onApplyCandidate,
}: CPChordEvolutionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropDismiss}
          onPress={onRequestClose}
          accessibilityRole="button"
          accessibilityLabel="コード発展の背景を閉じる"
        />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>コードを発展</Text>
              <Text style={styles.scope}>{scopeLabel}</Text>
            </View>
            <Pressable
              onPress={onRequestClose}
              accessibilityRole="button"
              accessibilityLabel="コード発展を閉じる"
              hitSlop={8}
              style={styles.close}>
              <Icon name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.levels} accessibilityRole="tablist">
            {levels.map((option) => {
              const selected = option.level === activeLevel;
              return (
                <Pressable
                  key={option.level}
                  onPress={() => onSelectLevel(option.level)}
                  accessibilityRole="tab"
                  accessibilityLabel={`${option.label}レベル`}
                  accessibilityState={{ selected }}
                  style={[styles.level, selected && styles.levelSelected]}>
                  <Text
                    style={[styles.levelText, selected && styles.levelTextSelected]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    maxFontSizeMultiplier={1.2}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.body}>
            {activeLevel === 'original' ? (
              <View style={styles.original}>
                <Text style={styles.sectionLabel}>現在のコード</Text>
                <Text style={styles.summary} numberOfLines={3}>
                  {originalSummary}
                </Text>
                <ActionButton
                  label="試聴"
                  accessibilityLabel="Originalを試聴"
                  onPress={onPreviewOriginal}
                />
              </View>
            ) : candidates.length === 0 ? (
              <View style={styles.empty} accessibilityRole="text">
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.candidateScroll}
                contentContainerStyle={styles.candidateList}
                showsVerticalScrollIndicator={false}>
                {candidates.map((candidate, index) => (
                  <View key={candidate.id} style={styles.candidate}>
                    <View style={styles.candidateHeader}>
                      <Text style={styles.candidateTitle}>{candidate.title}</Text>
                      {candidate.changedCount > 1 ? (
                        <Text style={styles.changedCount}>{candidate.changedCount}コード</Text>
                      ) : null}
                    </View>
                    <Text style={styles.summary} numberOfLines={3}>
                      {candidate.summary}
                    </Text>
                    {candidate.rationale ? (
                      <Text style={styles.rationale}>{candidate.rationale}</Text>
                    ) : null}
                    <View style={styles.actions}>
                      <ActionButton
                        label="試聴"
                        accessibilityLabel={`${candidate.title}候補${index + 1}を試聴`}
                        onPress={() => onPreviewCandidate(candidate.id)}
                      />
                      <ActionButton
                        label={candidate.applyLabel}
                        accessibilityLabel={`${candidate.title}候補${
                          index + 1
                        }を${candidate.applyLabel}`}
                        primary={!candidate.applyLocked}
                        locked={candidate.applyLocked}
                        onPress={() => onApplyCandidate(candidate.id)}
                      />
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    height: '82%',
    maxHeight: '88%',
    paddingHorizontal: spacing.s16,
    paddingTop: spacing.s12,
    paddingBottom: spacing.s32,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfacePanel,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginBottom: spacing.s16,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.s16,
  },
  headerCopy: { flex: 1 },
  title: {
    color: colors.textBright,
    fontFamily: font.bold,
    fontWeight: '700',
    fontSize: typeSize.chord,
  },
  scope: {
    marginTop: spacing.s4,
    color: colors.textDim,
    fontFamily: font.semibold,
    fontSize: typeSize.caption,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceIconBtn,
  },
  levels: {
    flexDirection: 'row',
    gap: spacing.s4,
    padding: spacing.s4,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  level: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  levelSelected: {
    borderWidth: 1,
    borderColor: colors.primaryBlue,
    backgroundColor: colors.surfaceRaised,
  },
  levelText: {
    color: colors.textMuted,
    fontFamily: font.semibold,
    fontWeight: '600',
    fontSize: typeSize.body,
  },
  levelTextSelected: {
    color: colors.textBright,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  original: {
    marginTop: spacing.s16,
    gap: spacing.s12,
    padding: spacing.s16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  sectionLabel: {
    color: colors.textDim,
    fontFamily: font.semibold,
    fontSize: typeSize.label,
  },
  summary: {
    color: colors.textSecondary,
    fontFamily: font.semibold,
    fontSize: typeSize.body,
    lineHeight: 20,
  },
  rationale: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: typeSize.label,
    lineHeight: 18,
  },
  empty: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s24,
  },
  emptyText: {
    color: colors.textDim,
    fontFamily: font.regular,
    fontSize: typeSize.body,
    lineHeight: 20,
    textAlign: 'center',
  },
  candidateScroll: { flex: 1, marginTop: spacing.s16 },
  candidateList: {
    gap: spacing.s12,
    paddingBottom: spacing.s24,
  },
  candidate: {
    gap: spacing.s12,
    padding: spacing.s16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  candidateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  candidateTitle: {
    color: colors.textBright,
    fontFamily: font.bold,
    fontWeight: '700',
    fontSize: typeSize.body,
  },
  changedCount: {
    color: colors.textDim,
    fontFamily: font.semibold,
    fontSize: typeSize.caption,
  },
  actions: { flexDirection: 'row', gap: spacing.s8 },
  action: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  actionPrimary: {
    borderColor: colors.primaryBlue,
    backgroundColor: colors.primaryBlue,
  },
  actionLocked: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceLocked,
  },
  actionText: {
    color: colors.textSecondary,
    fontFamily: font.bold,
    fontWeight: '700',
    fontSize: typeSize.body,
  },
  actionTextPrimary: { color: colors.white },
  actionTextLocked: { color: colors.goldText },
  pressed: { opacity: 0.82 },
});

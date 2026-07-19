import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { SegTrack } from '@/components/controls';
import type { ChordContextActions } from '@/features/editor/useEditorActions';
import { colors, font, radius, spacing, typeSize } from '@/theme/tokens';
import type { ChordDuration } from '@/types';

/**
 * Long-Press Context Menu for a placed chord (refinement §4 削減マトリクス / §2 L2).
 *
 * Presentational only: it renders the chord-context capability flags and calls
 * back the existing `session.*`-backed handlers. Business logic / Data Model are
 * untouched (handlers are wired by the screen via `useEditorActions`).
 *
 * Contract highlights:
 *   - UNAVAILABLE = HIDE: a row is only shown when its capability flag is true
 *     (e.g. "前へ移動" is hidden for the first card), never rendered as disabled.
 *   - Delete is the only Destructive-colored action (`colors.danger`).
 *   - Every tappable row is ≥ 44pt tall (Release Gate Tap Target).
 */
export type CPChordContextMenuProps = {
  visible: boolean;
  /** Chord display name shown as the sheet title (the chord stays the star). */
  chordLabel: string;
  /** Secondary degree label (e.g. "IV" / "V7"). */
  degreeLabel?: string;
  durationBeats: ChordDuration;
  context: ChordContextActions;
  onRequestClose: () => void;
  onDuplicate: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  onSetDuration: (beats: ChordDuration) => void;
};

const DURATION_OPTIONS = [
  { key: '4', label: '1小節' },
  { key: '2', label: '1/2小節' },
  { key: '1', label: '1/4小節' },
];

/** Derive a translucent tint from a token hex (keeps direct color values out). */
function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function MenuRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const tint = destructive ? colors.dangerText : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        destructive && styles.rowDestructive,
        pressed && styles.rowPressed,
      ]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={18} color={tint} strokeWidth={2.2} />
      </View>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
    </Pressable>
  );
}

export function CPChordContextMenu({
  visible,
  chordLabel,
  degreeLabel,
  durationBeats,
  context,
  onRequestClose,
  onDuplicate,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onSetDuration,
}: CPChordContextMenuProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onRequestClose}>
      <Pressable style={styles.backdrop} onPress={onRequestClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {chordLabel}
            </Text>
            {degreeLabel ? <Text style={styles.subtitle}>{degreeLabel}</Text> : null}
          </View>

          {context.canEditDuration ? (
            <View style={styles.durationBlock}>
              <Text style={styles.sectionLabel}>長さ</Text>
              <SegTrack
                options={DURATION_OPTIONS}
                value={String(durationBeats)}
                onChange={(k) => onSetDuration(Number(k) as ChordDuration)}
              />
            </View>
          ) : null}

          <View style={styles.rows}>
            {context.canDuplicate ? (
              <MenuRow icon="duplicate" label="複製" onPress={onDuplicate} />
            ) : null}
            {context.canMoveLeft ? (
              <MenuRow icon="chevronLeft" label="前へ移動" onPress={onMoveLeft} />
            ) : null}
            {context.canMoveRight ? (
              <MenuRow icon="chevronRight" label="後へ移動" onPress={onMoveRight} />
            ) : null}
            {context.canDelete ? (
              <MenuRow icon="trash" label="削除" onPress={onDelete} destructive />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfacePanel,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.s16,
    paddingTop: spacing.s12,
    paddingBottom: spacing.s32,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.s16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.s8,
    marginBottom: spacing.s16,
    paddingHorizontal: spacing.s4,
  },
  title: {
    flexShrink: 1,
    color: colors.textBright,
    fontFamily: font.bold,
    fontWeight: '700',
    fontSize: typeSize.chord,
  },
  subtitle: {
    color: colors.textDim,
    fontFamily: font.semibold,
    fontWeight: '600',
    fontSize: typeSize.label,
  },
  durationBlock: {
    marginBottom: spacing.s16,
    gap: spacing.s8,
  },
  sectionLabel: {
    color: colors.textDim,
    fontFamily: font.semibold,
    fontWeight: '600',
    fontSize: typeSize.label,
    paddingHorizontal: spacing.s4,
  },
  rows: {
    gap: spacing.s8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s12,
    minHeight: 44,
    paddingHorizontal: spacing.s12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  rowDestructive: {
    backgroundColor: rgba(colors.danger, 0.1),
    borderColor: rgba(colors.danger, 0.3),
  },
  rowPressed: { opacity: 0.85 },
  rowIcon: { width: 24, alignItems: 'center' },
  rowLabel: {
    color: colors.textSecondary,
    fontFamily: font.semibold,
    fontWeight: '600',
    fontSize: typeSize.body,
  },
  rowLabelDestructive: { color: colors.dangerText, fontFamily: font.bold, fontWeight: '700' },
});

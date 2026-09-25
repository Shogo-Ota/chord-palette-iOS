import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  CHORD_STYLE_OVERRIDE_OPTIONS,
  chordStyleOverrideOption,
} from '@/features/editor/chordStyleOverrideOptions';
import { colors, font, radius, spacing, typeSize } from '@/theme/tokens';
import type { ChordAccompanimentOverride } from '@/types';

export type CPChordStyleSheetProps = {
  visible: boolean;
  chordLabel: string;
  globalStyleLabel: string;
  value?: ChordAccompanimentOverride;
  locked: boolean;
  onRequestClose: () => void;
  onSelect: (override: ChordAccompanimentOverride | undefined) => void;
};

export function CPChordStyleSheet({
  visible,
  chordLabel,
  globalStyleLabel,
  value,
  locked,
  onRequestClose,
  onSelect,
}: CPChordStyleSheetProps) {
  const selected = chordStyleOverrideOption(value);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onRequestClose}>
      <Pressable style={styles.backdrop} onPress={onRequestClose}>
        <Pressable
          style={styles.sheet}
          onPress={(event) => event.stopPropagation()}
          accessibilityViewIsModal>
          <View style={styles.grabber} />
          <Text style={styles.title}>このコードの伴奏STYLE</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {chordLabel} 1件だけに適用
          </Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            <StyleRow
              label="全体のSTYLEを使用"
              hint={`現在: ${globalStyleLabel}`}
              selected={!selected}
              onPress={() => onSelect(undefined)}
            />
            {CHORD_STYLE_OVERRIDE_OPTIONS.map((option) => (
              <StyleRow
                key={option.id}
                testID={`chord-style-${option.id}`}
                label={option.displayLabel}
                hint={option.hint}
                selected={selected?.id === option.id}
                locked={locked}
                onPress={() =>
                  onSelect({
                    pattern: option.pattern,
                    variant: option.variant,
                  })
                }
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StyleRow({
  testID,
  label,
  hint,
  selected,
  locked,
  onPress,
}: {
  testID?: string;
  label: string;
  hint: string;
  selected: boolean;
  locked?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={locked ? 'Palette Proへの登録後に設定できます' : hint}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{label}</Text>
        <Text style={styles.rowHint} numberOfLines={1}>
          {hint}
        </Text>
      </View>
      {selected ? (
        <Icon name="check" size={17} color={colors.primary} strokeWidth={2.6} />
      ) : locked ? (
        <Icon name="lock" size={15} color={colors.textFaint} strokeWidth={2.2} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '82%',
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
  title: {
    color: colors.textBright,
    fontFamily: font.bold,
    fontWeight: '700',
    fontSize: typeSize.body,
  },
  subtitle: {
    color: colors.textDim,
    fontFamily: font.semibold,
    fontWeight: '600',
    fontSize: typeSize.label,
    marginTop: spacing.s4,
    marginBottom: spacing.s12,
  },
  list: { flexGrow: 0 },
  listContent: { gap: spacing.s8 },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s12,
    paddingHorizontal: spacing.s12,
    paddingVertical: spacing.s8,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  rowSelected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.primary,
  },
  rowPressed: { opacity: 0.84 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: {
    color: colors.textSecondary,
    fontFamily: font.semibold,
    fontWeight: '600',
    fontSize: typeSize.body,
  },
  rowLabelSelected: { color: colors.textBright },
  rowHint: {
    color: colors.textFaint,
    fontSize: typeSize.caption,
    marginTop: 2,
  },
});

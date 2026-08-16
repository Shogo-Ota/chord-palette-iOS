import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing, typeSize } from '@/theme/tokens';

export type CPSettingChipProps = {
  /** Small uppercase caption above the value (e.g. "KEY"). */
  label: string;
  /** Main value shown large (e.g. "C Major"). */
  value: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Lines the value may wrap onto before it ellipsizes. Default 1. */
  valueLines?: number;
  onPress: () => void;
};

/**
 * One independent session-setting chip (Key / Tempo / Style).
 * Presentational only — opens a picker via `onPress`, no business logic.
 * Replaces the aggregated CPSessionCapsule so each setting is directly tappable.
 */
export function CPSettingChip({
  label,
  value,
  accessibilityLabel,
  accessibilityHint,
  valueLines = 1,
  onPress,
}: CPSettingChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityValue={{ text: value }}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={valueLines}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexGrow: 1,
    flexBasis: 96,
    minWidth: 96,
    minHeight: 44,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.s12,
    paddingVertical: spacing.s8,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  pressed: { opacity: 0.85, borderColor: colors.primary },
  label: {
    fontSize: typeSize.caption,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.textFaint,
    letterSpacing: 0.7,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: {
    flex: 1,
    fontSize: typeSize.label,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});

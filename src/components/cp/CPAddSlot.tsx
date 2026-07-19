import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, font, radius, spacing, typeSize } from '@/theme/tokens';

export type CPAddSlotProps = {
  onPress: () => void;
};

/** Trailing “＋” slot on the Chord Canvas. */
export function CPAddSlot({ onPress }: CPAddSlotProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="コードを追加"
      style={({ pressed }) => [styles.slot, pressed && styles.pressed]}>
      <Icon name="plus" size={18} color={colors.textMuted} />
      <Text style={styles.label}>追加</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    minWidth: 64,
    paddingHorizontal: spacing.s12,
    paddingVertical: spacing.s12,
    borderRadius: radius.chordCard,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s4,
  },
  pressed: { opacity: 0.85 },
  label: {
    color: colors.textFaint,
    fontFamily: font.medium,
    fontSize: typeSize.caption,
  },
});

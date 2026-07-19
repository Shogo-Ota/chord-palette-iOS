import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, font, radius, spacing, typeSize } from '@/theme/tokens';

export type CPSessionCapsuleProps = {
  keyLabel: string;
  bpm: number;
  styleLabel: string;
  soundLabel: string;
  onPress: () => void;
};

/** Single L0 control that opens the Session Sheet (Key/BPM/Style/Sound). */
export function CPSessionCapsule({
  keyLabel,
  bpm,
  styleLabel,
  soundLabel,
  onPress,
}: CPSessionCapsuleProps) {
  const summary = `${keyLabel} · ${bpm} BPM · ${styleLabel} · ${soundLabel}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="セッション設定"
      accessibilityHint="キー、テンポ、スタイル、音色を変更"
      style={({ pressed }) => [styles.capsule, pressed && styles.pressed]}>
      <Text style={styles.text} numberOfLines={1}>
        {summary}
      </Text>
      <View style={styles.chevron}>
        <Icon name="chevronDown" size={14} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s8,
    minHeight: 44,
    paddingHorizontal: spacing.s16,
    paddingVertical: spacing.s12,
    borderRadius: radius.capsule,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  pressed: { opacity: 0.85 },
  text: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: font.medium,
    fontSize: typeSize.label,
  },
  chevron: { marginLeft: spacing.s4 },
});

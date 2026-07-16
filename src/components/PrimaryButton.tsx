import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { colors, font, primaryGradient, radius } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  style?: ViewStyle;
};

/** Full-width primary CTA (purple→blue gradient). Shared across home / export. */
export function PrimaryButton({ label, onPress, icon, disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [style, (pressed || disabled) && styles.dim]}>
      <LinearGradient
        colors={primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btn}>
        {icon ? <Icon name={icon} size={18} color="#fff" strokeWidth={2.4} /> : null}
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius['3xl'],
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  label: { color: '#fff', fontSize: 16, fontFamily: font.bold, fontWeight: '700' },
  dim: { opacity: 0.55 },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VideoMotionPreference } from '@/lib/videoExport/comparison';
import { colors, font, radius } from '@/theme/tokens';

export function VideoMotionSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: VideoMotionPreference;
  onChange(value: VideoMotionPreference): void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>動き</Text>
      <View style={styles.control}>
        {(
          [
            ['standard', '標準'],
            ['reduced', '控えめ'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === id, disabled }}
            disabled={disabled}
            onPress={() => onChange(id)}
            style={[styles.option, value === id && styles.selected]}>
            <Text style={[styles.optionText, value === id && styles.selectedText]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13.5,
    fontFamily: font.semibold,
    fontWeight: '600',
  },
  control: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceInput,
    padding: 3,
  },
  option: {
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  selected: { backgroundColor: colors.surfaceRaised },
  optionText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: font.semibold,
    fontWeight: '600',
  },
  selectedText: { color: colors.textPrimary },
});

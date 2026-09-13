import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VideoTemplateId } from '@/lib/videoExport/comparison';
import { colors, font, radius } from '@/theme/tokens';

type Props = {
  value: VideoTemplateId;
  onChange(value: VideoTemplateId): void;
  compareEnabled: boolean;
  disabled?: boolean;
  compareReason?: string;
};

export function VideoTemplateSelector({
  value,
  onChange,
  compareEnabled,
  disabled = false,
  compareReason,
}: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>動画の構成</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        <Option
          label="通常"
          description="現在の進行を1周"
          selected={value === 'standard'}
          disabled={disabled}
          onPress={() => onChange('standard')}
        />
        <Option
          label="聴き比べ"
          description="原型 → 変奏"
          selected={value === 'compare'}
          disabled={disabled || !compareEnabled}
          onPress={() => onChange('compare')}
        />
      </View>
      {!compareEnabled && compareReason ? <Text style={styles.reason}>{compareReason}</Text> : null}
    </View>
  );
}

function Option({
  label,
  description,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${label}、${description}`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <View style={[styles.dot, selected && styles.dotSelected]} />
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 12 },
  heading: {
    marginBottom: 8,
    color: colors.textSecondary,
    fontSize: 13.5,
    fontFamily: font.semibold,
    fontWeight: '600',
  },
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.primaryBlue,
    backgroundColor: colors.surfaceRaised,
  },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78 },
  dot: {
    width: 7,
    height: 7,
    marginBottom: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textFaint,
  },
  dotSelected: {
    backgroundColor: colors.primaryBlue,
    borderColor: colors.primaryBlue,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  labelSelected: { color: colors.textPrimary },
  description: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10.5,
    fontFamily: font.medium,
  },
  reason: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: font.medium,
  },
});

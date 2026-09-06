import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  VIDEO_VISUAL_STYLES,
  type VideoVisualStyle,
} from '@/services/videoExport/videoVisualStyle';
import { colors, font, radius } from '@/theme/tokens';

export type VideoVisualStyleSelectorProps = {
  value: VideoVisualStyle;
  onChange(visualStyle: VideoVisualStyle): void;
  disabled?: boolean;
};

const STYLE_DEFINITIONS = Object.values(VIDEO_VISUAL_STYLES);

export function VideoVisualStyleSelector({
  value,
  onChange,
  disabled = false,
}: VideoVisualStyleSelectorProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>動画スタイル</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {STYLE_DEFINITIONS.map((definition) => {
          const selected = definition.id === value;
          return (
            <Pressable
              key={definition.id}
              accessibilityRole="radio"
              accessibilityLabel={`${definition.label}、${definition.description}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(definition.id)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && !disabled && styles.optionPressed,
                disabled && styles.optionDisabled,
              ]}>
              <View style={[styles.selectionDot, selected && styles.selectionDotSelected]} />
              <Text style={[styles.label, selected && styles.labelSelected]}>
                {definition.label}
              </Text>
              <Text style={styles.description} numberOfLines={2}>
                {definition.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 12,
  },
  heading: {
    marginBottom: 8,
    fontSize: 13.5,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  options: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.primaryBlue,
    backgroundColor: colors.surfaceRaised,
  },
  optionPressed: {
    opacity: 0.78,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  selectionDot: {
    width: 7,
    height: 7,
    marginBottom: 6,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: colors.textFaint,
  },
  selectionDotSelected: {
    borderColor: colors.primaryBlue,
    backgroundColor: colors.primaryBlue,
  },
  label: {
    fontSize: 12.5,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.textPrimary,
  },
  description: {
    minHeight: 30,
    marginTop: 4,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: font.medium,
    color: colors.textMuted,
  },
});

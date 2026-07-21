/**
 * CPSuggestionBar — presentational "続き候補" (next-chord suggestion) chip strip.
 *
 * Pure view: it renders ranked {@link ProgressionSuggestion}s and reports taps. All
 * musical reasoning and the append action live outside (domain `suggestNext` +
 * `useChordSuggestions`), so this component has no audio/billing/business logic.
 * Renders nothing when there are no suggestions.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import type { ProgressionSuggestion } from '@/lib/theory/progression/suggestNext';
import { colors, font, functionColor, radius } from '@/theme/tokens';

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function CPSuggestionBar({
  suggestions,
  onPick,
}: {
  suggestions: ProgressionSuggestion[];
  onPick: (s: ProgressionSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <View style={styles.wrap} accessibilityRole="menu" accessibilityLabel="続き候補">
      <View style={styles.head}>
        <View style={styles.headDot} />
        <Text style={styles.headText}>続き候補</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {suggestions.map((s) => {
          const accent = functionColor[s.function];
          return (
            <Pressable
              key={`${s.rootOffset}:${s.suffix}`}
              onPress={() => onPick(s)}
              accessibilityRole="button"
              accessibilityLabel={`${s.displayName} を追加`}
              style={[styles.chip, { borderColor: rgba(accent, 0.45), backgroundColor: rgba(accent, 0.1) }]}>
              <Icon name="plus" size={11} color={accent} strokeWidth={2.6} />
              <View style={styles.chipTextBlock}>
                <Text style={styles.chipName} numberOfLines={1}>
                  {s.displayName}
                </Text>
                <Text style={[styles.chipDegree, { color: accent }]} numberOfLines={1}>
                  {s.degreeLabel}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 2 },
  headDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  headText: {
    fontSize: 11.5,
    letterSpacing: 0.3,
    color: colors.purpleSoft,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 2, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipTextBlock: { alignItems: 'flex-start' },
  chipName: {
    fontSize: 14,
    lineHeight: 17,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chipDegree: { fontSize: 9.5, lineHeight: 12, fontFamily: font.semibold, fontWeight: '600' },
});

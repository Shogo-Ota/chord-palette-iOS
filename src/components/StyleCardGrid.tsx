import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StyleCardDef } from '@/lib/performance/model/styleCards';
import type { AccompanimentStyle } from '@/lib/performance/model/types';
import { colors, font, radius } from '@/theme/tokens';

/**
 * The style selector (UI洗練化指示書 §6): a two-column grid of tappable cards —
 * name, mood line, short description, 準備中 badge for styles the engine cannot
 * honestly play yet. Presentational only: which card is selected and what
 * selecting does belong to the screen.
 */
export function StyleCardGrid({
  cards,
  selectedId,
  onSelect,
}: {
  cards: readonly StyleCardDef[];
  selectedId?: AccompanimentStyle;
  onSelect: (card: StyleCardDef) => void;
}) {
  return (
    <View style={styles.grid}>
      {cards.map((card) => {
        const selected = card.id === selectedId;
        const comingSoon = card.status === 'comingSoon';
        return (
          <Pressable
            key={card.id}
            accessibilityRole="button"
            accessibilityLabel={`${card.label}: ${card.tagline}${comingSoon ? '（準備中）' : ''}`}
            accessibilityState={{ selected, disabled: comingSoon }}
            disabled={comingSoon}
            onPress={() => onSelect(card)}
            style={[styles.card, comingSoon && styles.cardComingSoon]}>
            {selected && (
              <LinearGradient
                colors={['rgba(124,92,255,0.20)', 'rgba(91,140,255,0.20)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, styles.cardSelectedFill]}
              />
            )}
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
                {card.label}
              </Text>
              {comingSoon && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>準備中</Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardTagline, comingSoon && styles.textDimmed]}>
              {card.tagline}
            </Text>
            <Text style={[styles.cardDesc, comingSoon && styles.textDimmed]} numberOfLines={2}>
              {card.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    // Two columns at every width: half the row minus half the gap.
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 96,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    paddingVertical: 13,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  cardSelectedFill: { borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.primary },
  cardComingSoon: { opacity: 0.75, backgroundColor: colors.surfaceLocked },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  cardTitle: { fontSize: 15.5, fontFamily: font.extrabold, fontWeight: '800', color: colors.textPrimary },
  cardTitleSelected: { color: colors.white },
  badge: {
    backgroundColor: colors.surfaceChip,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  badgeText: { fontSize: 10, fontFamily: font.semibold, fontWeight: '600', color: colors.textFaint },
  cardTagline: {
    fontSize: 12,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textTertiary,
    marginBottom: 4,
  },
  cardDesc: { fontSize: 12, lineHeight: 16.5, fontFamily: font.regular, color: colors.textFaint },
  textDimmed: { color: colors.textFaintest },
});

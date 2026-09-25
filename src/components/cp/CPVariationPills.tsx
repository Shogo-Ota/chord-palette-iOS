import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, font, radius, spacing, typeSize } from '@/theme/tokens';

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export type CPVariationPill = {
  id: string;
  /** Short pill caption, e.g. "sus4" or "maj9(#11)". */
  label: string;
  /** The chord this pill would produce, e.g. "Cmaj9(#11)". */
  preview: string;
  active: boolean;
  locked: boolean;
};

export type CPVariationPillsProps = {
  pills: CPVariationPill[];
  /**
   * `strong` marks the 強い色づけ row, so a deliberate character reads differently
   * from the safe colours above it without needing its own component.
   */
  tone?: 'normal' | 'strong';
  onPress: (id: string) => void;
};

/**
 * A wrapping row of chord-variation pills. Presentational only — which variations
 * a degree offers, and whether the player may place them, are decided by the
 * caller.
 */
export function CPVariationPills({ pills, tone = 'normal', onPress }: CPVariationPillsProps) {
  const strong = tone === 'strong';
  return (
    <View style={styles.row}>
      {pills.map((pill) => (
        <Pressable
          key={pill.id}
          accessibilityRole="button"
          accessibilityLabel={
            strong ? `${pill.label} — ${pill.preview}、強い色づけ` : `${pill.label} — ${pill.preview}`
          }
          accessibilityState={{ selected: pill.active, disabled: false }}
          style={[
            styles.pill,
            strong && styles.strong,
            pill.active && styles.active,
            pill.locked && styles.locked,
          ]}
          onPress={() => onPress(pill.id)}>
          <View style={styles.inner}>
            <Text style={styles.label}>{pill.label}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {pill.preview}
            </Text>
          </View>
          {pill.locked && <Icon name="lock" size={10} color={colors.gold} strokeWidth={2.4} />}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    backgroundColor: rgba(colors.pink, 0.12),
    borderWidth: 1,
    borderColor: rgba(colors.pink, 0.4),
    borderRadius: radius.md,
    paddingVertical: spacing.s8,
    paddingHorizontal: spacing.s16,
  },
  /** 強い色づけ: a warmer, dashed edge so it does not read as another safe colour. */
  strong: {
    backgroundColor: rgba(colors.gold, 0.1),
    borderColor: rgba(colors.gold, 0.55),
    borderStyle: 'dashed',
  },
  active: {
    backgroundColor: rgba(colors.primary, 0.22),
    borderColor: colors.primary,
    borderStyle: 'solid',
  },
  locked: {
    backgroundColor: colors.surfaceLocked,
    borderColor: colors.borderFaint,
  },
  inner: { alignItems: 'center' },
  label: {
    fontSize: typeSize.label,
    color: colors.pinkText,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  sub: {
    fontSize: 9,
    color: colors.textFaint,
    fontFamily: font.semibold,
    fontWeight: '600',
    marginTop: 1,
  },
});

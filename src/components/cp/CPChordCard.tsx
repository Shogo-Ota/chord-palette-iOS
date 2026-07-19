import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, font, radius, spacing, typeSize } from '@/theme/tokens';

export type CPChordCardProps = {
  label: string;
  selected?: boolean;
  playing?: boolean;
  /** Thin function accent (T/SD/D). */
  accentColor?: string;
  onPress?: () => void;
  onLongPress?: () => void;
};

/** Chord card for the Play Canvas (refinement §3 / §6). */
export function CPChordCard({
  label,
  selected,
  playing,
  accentColor,
  onPress,
  onLongPress,
}: CPChordCardProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        playing && styles.cardPlaying,
        pressed && styles.cardPressed,
        accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : null,
      ]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 72,
    paddingHorizontal: spacing.s12,
    paddingVertical: spacing.s12,
    borderRadius: radius.chordCard,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSelected: {
    borderColor: colors.primaryBlue,
    backgroundColor: colors.surfaceRaised,
  },
  cardPlaying: {
    transform: [{ translateY: -2 }],
    borderColor: colors.primary,
  },
  cardPressed: {
    opacity: 0.88,
  },
  label: {
    color: colors.textBright,
    fontFamily: font.semibold,
    fontSize: typeSize.chord,
  },
});

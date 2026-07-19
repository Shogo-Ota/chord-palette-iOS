import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { Icon } from '@/components/Icon';
import { colors, font, primaryGradient, radius, spacing, typeSize } from '@/theme/tokens';

/** Label shown when the empty-progression CTA transforms (§5 UNAVAILABLE=TRANSFORM). */
const EMPTY_LABEL = '最初のコードを選ぶ';

export type CPPlayPauseButtonProps = {
  playing: boolean;
  loading?: boolean;
  /** When true, parent should prefer not rendering (UNAVAILABLE=HIDE). */
  disabled?: boolean;
  /**
   * Empty progression → transform the CTA into "最初のコードを選ぶ" instead of a
   * dead-ending Play glyph. The press handler itself is wired by the parent.
   */
  emptyMode?: boolean;
  onPress: () => void;
};

/** The single filled accent CTA on the transport (refinement Complexity Budget). */
export function CPPlayPauseButton({
  playing,
  loading,
  disabled,
  emptyMode,
  onPress,
}: CPPlayPauseButtonProps) {
  if (disabled) return null;

  if (emptyMode && !loading) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={EMPTY_LABEL}
        accessibilityHint="コードライブラリを開きます"
        hitSlop={4}
        style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
        <LinearGradient
          colors={[...primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyBtn}>
          <Icon name="plus" size={20} color={colors.white} />
          <Text style={styles.emptyLabel}>{EMPTY_LABEL}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={playing ? '一時停止' : '再生'}
      hitSlop={4}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <LinearGradient
        colors={[...primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btn}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Icon name={playing ? 'pause' : 'play'} size={22} color={colors.white} />
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.pill },
  pressed: { opacity: 0.9 },
  btn: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s8,
    minHeight: 56,
    paddingHorizontal: spacing.s24,
    borderRadius: radius.pill,
  },
  emptyLabel: {
    color: colors.white,
    fontFamily: font.bold,
    fontWeight: '700',
    fontSize: typeSize.body,
  },
});

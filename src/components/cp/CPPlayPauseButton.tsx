import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { Icon } from '@/components/Icon';
import { colors, primaryGradient, radius } from '@/theme/tokens';

export type CPPlayPauseButtonProps = {
  playing: boolean;
  loading?: boolean;
  /** When true, parent should prefer not rendering (UNAVAILABLE=HIDE). */
  disabled?: boolean;
  onPress: () => void;
};

/** The single filled accent CTA on the transport (refinement Complexity Budget). */
export function CPPlayPauseButton({
  playing,
  loading,
  disabled,
  onPress,
}: CPPlayPauseButtonProps) {
  if (disabled) return null;

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
});

import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { CPPlayPauseButton } from '@/components/cp/CPPlayPauseButton';
import { colors, radius, spacing } from '@/theme/tokens';

export type CPTransportBarProps = {
  playing: boolean;
  loading?: boolean;
  /** Hide when no undo history (UNAVAILABLE=HIDE). */
  showUndo?: boolean;
  /** Hide when fewer than 2 chords (future Loop). */
  showLoop?: boolean;
  loopOn?: boolean;
  onPlayPause: () => void;
  onUndo?: () => void;
  onLoop?: () => void;
};

/** Transport row: optional Undo · filled Play/Pause · optional Loop (max 3 glyphs). */
export function CPTransportBar({
  playing,
  loading,
  showUndo,
  showLoop,
  loopOn,
  onPlayPause,
  onUndo,
  onLoop,
}: CPTransportBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {showUndo ? (
          <Pressable
            onPress={onUndo}
            accessibilityRole="button"
            accessibilityLabel="元に戻す"
            hitSlop={8}
            style={styles.glyph}>
            <Icon name="rewind" size={20} color={colors.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.glyphSpacer} />
        )}
      </View>
      <CPPlayPauseButton playing={playing} loading={loading} onPress={onPlayPause} />
      <View style={styles.side}>
        {showLoop ? (
          <Pressable
            onPress={onLoop}
            accessibilityRole="button"
            accessibilityLabel={loopOn ? 'ループ解除' : 'ループ'}
            hitSlop={8}
            style={[styles.glyph, loopOn && styles.glyphOn]}>
            <Icon name="skipForward" size={20} color={loopOn ? colors.primaryBlue : colors.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.glyphSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s24,
    paddingVertical: spacing.s8,
  },
  side: { width: 44, alignItems: 'center' },
  glyph: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceIconBtn,
  },
  glyphOn: { borderWidth: 1, borderColor: colors.primaryBlue },
  glyphSpacer: { width: 44, height: 44 },
});

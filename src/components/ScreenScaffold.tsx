import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';

type Props = {
  children: React.ReactNode;
  /** Horizontal content padding (mock uses 18–22). */
  padH?: number;
  scroll?: boolean;
  /** 'paywall' adds the deep-purple top glow used on the Pro screen. */
  variant?: 'default' | 'paywall';
  contentStyle?: ViewStyle;
};

/**
 * Full-screen dark container (mock base #0d1422).
 *
 * Uses measured safe-area insets (not a fixed frame) so it adapts precisely to
 * every iPhone — including the taller Dynamic Island devices (iPhone 15–17,
 * 402–440 pt wide). Content is laid out in pt units + flex, so it scales across
 * all screen sizes without hardcoded assumptions.
 */
export function ScreenScaffold({
  children,
  padH = 20,
  scroll = true,
  variant = 'default',
  contentStyle,
}: Props) {
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = {
    paddingTop: insets.top + 6,
    paddingBottom: insets.bottom + 28,
    paddingHorizontal: padH,
  };

  return (
    <View style={styles.root}>
      {variant === 'paywall' && (
        <LinearGradient
          colors={['#1a1338', colors.screenBg]}
          locations={[0, 0.55]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[pad, contentStyle]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, pad, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  fill: { flex: 1 },
});

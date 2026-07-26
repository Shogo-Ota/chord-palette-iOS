import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { GradientText } from '@/components/GradientText';
import { colors, font, rainbow } from '@/theme/tokens';

/** Rounded already, with transparent corners — do not clip it again. */
const ICON = require('../../assets/icon/icon.png');

type Props = {
  /** Wordmark font size. Icon size scales with it. */
  size?: number;
  /** Show the app icon to the left of the wordmark. */
  withIcon?: boolean;
  iconSize?: number;
};

/** "Chord Palette" lockup — "Chord" in bright text, "Palette" in the rainbow gradient. */
export function Wordmark({ size = 18, withIcon = false, iconSize }: Props) {
  const isize = iconSize ?? Math.round(size * 1.9);
  return (
    <View style={styles.row}>
      {withIcon && <Image source={ICON} style={[styles.icon, { width: isize, height: isize }]} />}
      <View style={styles.row}>
        <Text style={[styles.word, { fontSize: size }]}>Chord </Text>
        <GradientText colors={rainbow} style={[styles.word, { fontSize: size }]}>
          Palette
        </GradientText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: {
    marginRight: 10,
  },
  word: {
    fontFamily: font.extrabold,
    fontWeight: '800',
    color: colors.textBright,
    letterSpacing: 0.2,
  },
});

import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

type Props = {
  children: string;
  colors: readonly string[];
  style?: StyleProp<TextStyle>;
  /** 0 = horizontal (default), matches the mock's ~90–120deg text gradients. */
  start?: { x: number; y: number };
  end?: { x: number; y: number };
};

/**
 * Gradient-filled text (RN has no CSS `background-clip:text`).
 * Uses a MaskedView of the text over a LinearGradient — reproduces the rainbow
 * "Palette" wordmark and the large gradient chord name in the export preview.
 */
export function GradientText({
  children,
  colors,
  style,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0.2 },
}: Props) {
  return (
    <MaskedView
      maskElement={
        <Text style={[style, { backgroundColor: 'transparent' }]}>{children}</Text>
      }>
      <LinearGradient colors={colors as [string, string, ...string[]]} start={start} end={end}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

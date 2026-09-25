import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

type CPChordMetaLineProps = {
  degreeLabel: string;
  voicingBadge?: string;
  styleBadge?: string;
  style?: StyleProp<TextStyle>;
};

/** One compact line so a STYLE badge never adds height to a 1/4-bar chord card. */
export function CPChordMetaLine({
  degreeLabel,
  voicingBadge,
  styleBadge,
  style,
}: CPChordMetaLineProps) {
  const details = [degreeLabel, voicingBadge, styleBadge].filter(Boolean);
  return (
    <Text
      style={[styles.text, style]}
      numberOfLines={1}
      ellipsizeMode="tail"
      accessibilityLabel={details.join('、')}>
      {degreeLabel}
      {voicingBadge ? ` · ${voicingBadge}` : ''}
      {styleBadge ? ` · ${styleBadge}` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    flexShrink: 1,
  },
});

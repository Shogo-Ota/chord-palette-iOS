import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius } from '@/theme/tokens';

type Props = {
  title: string;
  hint: string;
};

/** Dashed empty-state panel used on list / strip screens. */
export function EmptyState({ title, hint }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    borderStyle: 'dashed',
    borderRadius: radius['3xl'],
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 14.5, fontFamily: font.bold, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  hint: { fontSize: 12.5, color: colors.textFaint, textAlign: 'center', lineHeight: 18 },
});

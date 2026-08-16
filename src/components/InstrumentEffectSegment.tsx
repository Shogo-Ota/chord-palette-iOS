import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Toggle } from '@/components/controls';
import type { InstrumentEffect } from '@/lib/performance/effect';
import { colors, font } from '@/theme/tokens';

/** ピアノ / エレピのエフェクト — デフォルトはサステイン。操作はリリースカットのみ。 */
export function InstrumentEffectSegment({
  value,
  onChange,
}: {
  value: InstrumentEffect;
  onChange: (effect: InstrumentEffect) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>リリースカット</Text>
      <Toggle
        value={value === 'releaseCut'}
        onValueChange={(on) => onChange(on ? 'releaseCut' : 'sustain')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 14,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

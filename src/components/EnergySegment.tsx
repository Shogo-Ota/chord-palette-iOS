import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SegTrack } from '@/components/controls';
import {
  ENERGY_HINTS,
  ENERGY_IDS,
  ENERGY_LABELS,
  type AccompanimentEnergy,
} from '@/lib/performance/energy';
import { colors, font } from '@/theme/tokens';

/**
 * 「盛り上がり」segmented control — Style と独立した Energy（verse/build/chorus）。
 * Hint text shows only for the selected value so the UI stays quiet.
 */
export function EnergySegment({
  value,
  onChange,
}: {
  value: AccompanimentEnergy;
  onChange: (energy: AccompanimentEnergy) => void;
}) {
  return (
    <View style={styles.wrap}>
      <SegTrack
        options={ENERGY_IDS.map((id) => ({ key: id, label: ENERGY_LABELS[id] }))}
        value={value}
        onChange={(k) => onChange(k as AccompanimentEnergy)}
      />
      <Text style={styles.hint}>{ENERGY_HINTS[value]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  hint: {
    marginTop: 8,
    fontSize: 11.5,
    fontFamily: font.medium,
    color: colors.textFaint,
    textAlign: 'center',
  },
});

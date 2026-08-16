import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SegTrack } from '@/components/controls';
import { DRUM_MODE_IDS, DRUM_MODE_LABELS, type DrumMode } from '@/lib/drum/drumMode';

/** ドラム再生モード — オフ / クラップ / フル。 */
export function DrumModeSegment({
  value,
  onChange,
}: {
  value: DrumMode;
  onChange: (mode: DrumMode) => void;
}) {
  return (
    <View style={styles.wrap}>
      <SegTrack
        options={DRUM_MODE_IDS.map((id) => ({ key: id, label: DRUM_MODE_LABELS[id] }))}
        value={value}
        onChange={(k) => onChange(k as DrumMode)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
});

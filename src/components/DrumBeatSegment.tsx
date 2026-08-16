import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SegTrack } from '@/components/controls';
import { DRUM_BEAT_IDS, DRUM_BEAT_LABELS, type DrumBeat } from '@/lib/drum/drumBeat';

/** フルキットの細かさ — 8ビート / 16ビート / 3連符。クラップとオフでは出さない。 */
export function DrumBeatSegment({
  value,
  onChange,
}: {
  value: DrumBeat;
  onChange: (beat: DrumBeat) => void;
}) {
  return (
    <View style={styles.wrap}>
      <SegTrack
        options={DRUM_BEAT_IDS.map((id) => ({ key: id, label: DRUM_BEAT_LABELS[id] }))}
        value={value}
        onChange={(k) => onChange(k as DrumBeat)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
});

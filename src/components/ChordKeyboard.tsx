import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { midiNoteName } from '@/data/music';
import { highlightedKeys, keyboardLayout, pitchClass } from '@/lib/keyboard';
import { colors, font } from '@/theme/tokens';
import type { MajorKey } from '@/types';

type Props = {
  /** Active chord notes (MIDI). Folded into the visible range for display. */
  notes: number[];
  /** Key used to spell note-name labels (♭ vs ♯). */
  musicKey: MajorKey;
  /** Highlight color for pressed keys + labels (chord-function color). */
  color: string;
  /** Total keyboard width in px. */
  width: number;
  /** Lowest / highest MIDI key drawn. Defaults to C2..C4. */
  low?: number;
  high?: number;
  /** White-key height in px. */
  height?: number;
  /** Show note-name labels above pressed keys + octave (C2/C3…) markers. */
  labels?: boolean;
};

const LABEL_H = 16;

/**
 * A compact piano keyboard that highlights the notes of a chord. Composition mirrors
 * the export reference (labels above pressed keys, octave markers under each C) but
 * uses the app's dark theme + chord-function accent color.
 */
export function ChordKeyboard({
  notes,
  musicKey,
  color,
  width,
  low = 36,
  high = 60,
  height = 116,
  labels = true,
}: Props) {
  const layout = useMemo(() => keyboardLayout(low, high, width), [low, high, width]);
  const active = useMemo(() => highlightedKeys(notes, low, high), [notes, low, high]);

  const whites = layout.filter((k) => !k.isBlack);
  const blacks = layout.filter((k) => k.isBlack);
  const blackH = height * 0.62;

  return (
    <View style={{ width }}>
      {/* note-name labels above pressed keys */}
      {labels && (
        <View style={{ height: LABEL_H }}>
          {layout
            .filter((k) => active.has(k.midi))
            .map((k) => (
              <Text
                key={`lbl-${k.midi}`}
                numberOfLines={1}
                style={[
                  styles.label,
                  { left: k.left - width * 0.06, width: k.width + width * 0.12, color },
                ]}>
                {midiNoteName(musicKey, k.midi)}
              </Text>
            ))}
        </View>
      )}

      <View style={[styles.board, { width, height }]}>
        {/* white keys */}
        {whites.map((k) => {
          const on = active.has(k.midi);
          return (
            <View
              key={k.midi}
              style={[
                styles.white,
                { left: k.left, width: k.width, height },
                on && { backgroundColor: color, borderColor: color },
              ]}
            />
          );
        })}

        {/* black keys (on top) */}
        {blacks.map((k) => {
          const on = active.has(k.midi);
          return (
            <View
              key={k.midi}
              style={[
                styles.black,
                { left: k.left, width: k.width, height: blackH },
                on && { backgroundColor: color },
              ]}
            />
          );
        })}
      </View>

      {/* octave markers under each C */}
      {labels && (
        <View style={{ height: LABEL_H }}>
          {whites
            .filter((k) => pitchClass(k.midi) === 0)
            .map((k) => (
              <Text
                key={`oct-${k.midi}`}
                style={[styles.octave, { left: k.left, width: k.width }]}>
                {`C${Math.floor(k.midi / 12) - 1}`}
              </Text>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    position: 'relative',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#0b0f18',
  },
  white: {
    position: 'absolute',
    bottom: 0,
    top: 0,
    backgroundColor: '#e9edf5',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: '#0b0f18',
  },
  black: {
    position: 'absolute',
    top: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: '#0e1320',
    zIndex: 2,
  },
  label: {
    position: 'absolute',
    top: 0,
    textAlign: 'center',
    fontSize: 8.5,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  octave: {
    position: 'absolute',
    top: 2,
    textAlign: 'center',
    fontSize: 7.5,
    color: colors.textFaint,
    fontFamily: font.semibold,
    fontWeight: '600',
  },
});

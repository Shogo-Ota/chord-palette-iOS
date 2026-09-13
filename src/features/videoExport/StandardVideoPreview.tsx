import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { ChordKeyboard } from '@/components/ChordKeyboard';
import { GradientText } from '@/components/GradientText';
import { chordPreviewMidiNotes } from '@/features/editor/playback';
import { colors, font, functionColor, radius, rainbow } from '@/theme/tokens';
import type { ChordEvent, MajorKey } from '@/types';

const ICON = require('../../../assets/icon/icon.png');
const PREVIEW_W = 214;
const PREVIEW_PAD = 14;
const KEYBOARD_W = PREVIEW_W - PREVIEW_PAD * 2;
const DOT_MAX = 8;
const DOT_MIN = 3.5;
const DOT_GAP_RATIO = 0.8;

function usePreviewIndex(progression: ChordEvent[], bpm: number): number {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    if (progression.length === 0) return;
    let current = 0;
    let timer: ReturnType<typeof setTimeout>;
    const secPerBeat = 60 / Math.max(1, bpm);
    const schedule = () => {
      const duration = Math.max(0.25, (progression[current]?.durationBeats ?? 4) * secPerBeat);
      timer = setTimeout(() => {
        current = (current + 1) % progression.length;
        setIdx(current);
        schedule();
      }, duration * 1000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [bpm, progression]);
  return progression.length === 0 ? 0 : idx % progression.length;
}

export function StandardVideoPreview({
  title,
  musicKey,
  bpm,
  bars,
  progression,
  octaveShift,
}: {
  title: string;
  musicKey: MajorKey;
  bpm: number;
  bars: number;
  progression: ChordEvent[];
  octaveShift: number;
}) {
  const index = usePreviewIndex(progression, bpm);
  const current = progression[index];
  const accent = current ? functionColor[current.function] : colors.primary;
  const notes = current ? chordPreviewMidiNotes(current, musicKey, octaveShift) : [];

  return (
    <View style={styles.preview}>
      <LinearGradient
        colors={[colors.screenGradientTop, colors.screenGradientMid, colors.appBg]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta}>
          {musicKey} · BPM {bpm} · {bars}小節
        </Text>
      </View>
      <View style={styles.center}>
        {current ? (
          <>
            <Text style={[styles.bigChord, { color: accent }]} numberOfLines={1}>
              {current.displayName}
            </Text>
            <Text style={styles.degree}>{current.degreeLabel}</Text>
          </>
        ) : (
          <Text style={styles.emptyChord}>コードがありません</Text>
        )}
      </View>
      {progression.length > 0 ? (
        <View style={styles.strip}>
          {progression.map((chord, chordIndex) => {
            const count = progression.length;
            const denom = count + DOT_GAP_RATIO * Math.max(0, count - 1);
            const size = Math.max(DOT_MIN, Math.min(DOT_MAX, KEYBOARD_W / denom));
            const gap = size * DOT_GAP_RATIO;
            const active = chordIndex === index;
            const color = functionColor[chord.function];
            return (
              <View
                key={chord.id}
                style={[
                  {
                    width: size,
                    height: size,
                    marginHorizontal: gap / 2,
                    borderRadius: size / 2,
                    borderWidth: 1.2,
                    borderColor: color,
                  },
                  active
                    ? {
                        backgroundColor: color,
                        shadowColor: color,
                        shadowOpacity: 0.9,
                        shadowRadius: size * 0.9,
                        shadowOffset: { width: 0, height: 0 },
                      }
                    : { opacity: 0.4 },
                ]}
              />
            );
          })}
        </View>
      ) : null}
      <View style={styles.keyboard}>
        <ChordKeyboard notes={notes} musicKey={musicKey} color={accent} width={KEYBOARD_W} />
      </View>
      <View style={styles.watermark}>
        <Image source={ICON} style={styles.icon} />
        <Text style={styles.brandText}>Chord </Text>
        <GradientText colors={rainbow} style={styles.brandText}>
          Palette
        </GradientText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: PREVIEW_W,
    height: 380,
    alignSelf: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    borderRadius: radius['4xl'],
    borderWidth: 1,
    borderColor: colors.borderFaint,
    paddingHorizontal: PREVIEW_PAD,
    paddingTop: 22,
    paddingBottom: 16,
  },
  top: { alignItems: 'center' },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    letterSpacing: 0.3,
    fontFamily: font.extrabold,
    fontWeight: '800',
  },
  meta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: font.semibold,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigChord: {
    fontSize: 46,
    lineHeight: 50,
    fontFamily: font.black,
    fontWeight: '900',
  },
  degree: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 15,
    letterSpacing: 0.5,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  emptyChord: {
    color: colors.textDim,
    fontSize: 13,
    fontFamily: font.semibold,
    fontWeight: '600',
  },
  strip: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboard: { alignItems: 'center', marginBottom: 26 },
  watermark: {
    position: 'absolute',
    right: 0,
    bottom: 8,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    opacity: 0.55,
  },
  icon: { width: 16, height: 16 },
  brandText: {
    color: colors.textPrimary,
    fontSize: 9.5,
    fontFamily: font.bold,
    fontWeight: '700',
  },
});

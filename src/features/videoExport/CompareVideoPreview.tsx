import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { CompareSceneManifestV1 } from '@/lib/videoExport/comparison';
import { colors, font, radius } from '@/theme/tokens';

import { comparePreviewStateAtElapsedSec } from './comparePreviewAdapter';

const ICON = require('../../../assets/icon/icon.png');

type Props = {
  scene: CompareSceneManifestV1 | null;
  preparing?: boolean;
  error?: string | null;
};

export function CompareVideoPreview({ scene, preparing = false, error = null }: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    setElapsedSec(0);
    if (!scene) return;
    const startedAt = Date.now();
    const timer = setInterval(
      () => {
        setElapsedSec((Date.now() - startedAt) / 1000);
      },
      scene.motion === 'reduced' ? 160 : 33,
    );
    return () => clearInterval(timer);
  }, [scene]);

  if (!scene) {
    return (
      <View style={[styles.preview, styles.placeholder]}>
        <Text style={styles.placeholderTitle}>
          {preparing ? '聴き比べを準備中…' : '聴き比べプレビュー'}
        </Text>
        <Text style={styles.placeholderText}>
          {error ?? '原型と変奏の映像計画をここに表示します'}
        </Text>
      </View>
    );
  }
  const state = comparePreviewStateAtElapsedSec(scene, elapsedSec);
  if (!state) return null;
  const roleLabel = state.role === 'base' ? scene.copy.baseLabel : scene.copy.variantLabel;

  return (
    <View style={styles.preview}>
      <View style={styles.topGlow} />
      <Text style={styles.title} numberOfLines={1}>
        {scene.title}
      </Text>
      <View style={[styles.rolePill, state.role === 'variant' && styles.rolePillVariant]}>
        <Text style={[styles.role, state.role === 'variant' && styles.roleVariant]}>
          {roleLabel}
        </Text>
      </View>
      <Text style={styles.hook} numberOfLines={2}>
        {scene.copy.hook}
      </Text>
      <Text
        style={[
          styles.current,
          state.cue.changed && state.role === 'variant' && styles.currentChanged,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {state.cue.currentChord}
      </Text>
      <Text style={styles.next} numberOfLines={1}>
        {state.cue.nextChord ? `NEXT  ${state.cue.nextChord}` : ' '}
      </Text>
      <Text
        style={[
          styles.change,
          { opacity: state.cue.changeLabel ? 0.55 + state.revealProgress * 0.45 : 0 },
        ]}>
        {state.cue.changeLabel ?? ' '}
      </Text>
      <View style={styles.cards}>
        {state.page.cards.map((card) => {
          const current = card.eventId === state.cue.eventId;
          const anticipated = card.eventId === state.anticipatedCue?.eventId;
          return (
            <View
              key={card.eventId}
              style={[
                styles.card,
                current && styles.cardCurrent,
                current && card.changed && styles.cardChanged,
                anticipated && styles.cardAnticipated,
              ]}>
              <Text
                style={[styles.cardChord, !current && styles.cardMuted]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {card.displayName}
              </Text>
              <Text style={styles.cardDegree} numberOfLines={1}>
                {card.degreeLabel}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.brand}>
        <Image source={ICON} style={styles.icon} />
        <Text style={styles.brandText}>Chord Palette</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: 214,
    height: 380,
    alignSelf: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    alignItems: 'center',
    borderRadius: radius['4xl'],
    borderWidth: 1,
    borderColor: colors.borderFaint,
    backgroundColor: colors.appBg,
    paddingHorizontal: 14,
    paddingTop: 20,
  },
  placeholder: { justifyContent: 'center', paddingHorizontal: 24 },
  placeholderTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  placeholderText: {
    marginTop: 8,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: font.medium,
  },
  topGlow: {
    position: 'absolute',
    top: -80,
    width: 260,
    height: 180,
    borderRadius: 130,
    backgroundColor: 'rgba(98,200,255,0.06)',
  },
  title: {
    maxWidth: 180,
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: font.semibold,
    fontWeight: '600',
  },
  rolePill: {
    marginTop: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(98,200,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  rolePillVariant: { backgroundColor: 'rgba(75,227,181,0.12)' },
  role: {
    color: '#62c8ff',
    fontSize: 9,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  roleVariant: { color: '#4be3b5' },
  hook: {
    minHeight: 30,
    marginTop: 12,
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 17,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  current: {
    width: 185,
    marginTop: 10,
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 44,
    lineHeight: 50,
    fontFamily: font.black,
    fontWeight: '900',
  },
  currentChanged: { color: '#4be3b5' },
  next: {
    marginTop: 4,
    color: colors.textFaint,
    fontSize: 10,
    fontFamily: font.semibold,
    fontWeight: '600',
  },
  change: {
    minHeight: 20,
    marginTop: 7,
    color: '#4be3b5',
    fontSize: 12,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  cards: {
    width: '100%',
    marginTop: 14,
    flexDirection: 'row',
    gap: 5,
  },
  card: {
    flex: 1,
    minWidth: 0,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: 2,
  },
  cardCurrent: {
    borderColor: '#62c8ff',
    backgroundColor: 'rgba(98,200,255,0.08)',
  },
  cardChanged: { borderColor: '#4be3b5' },
  cardAnticipated: { borderWidth: 2, borderColor: '#4be3b5' },
  cardChord: {
    maxWidth: '100%',
    color: colors.textPrimary,
    fontSize: 10,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  cardMuted: { color: colors.textMuted },
  cardDegree: {
    marginTop: 2,
    color: colors.textFaint,
    fontSize: 7,
    fontFamily: font.medium,
  },
  brand: {
    position: 'absolute',
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.82,
  },
  icon: { width: 16, height: 16, borderRadius: 4 },
  brandText: {
    color: colors.textPrimary,
    fontSize: 9.5,
    fontFamily: font.bold,
    fontWeight: '700',
  },
});

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { GradientText } from '@/components/GradientText';
import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { colors, font, radius, rainbow } from '@/theme/tokens';

const APP_ICON = require('../../assets/icon/app-icon.png');

type Perk = { glyph: string; color: string; bg: string; border: string; title: string; desc: string };
const PERKS: Perk[] = [
  {
    glyph: '♪',
    color: '#8fb6f2',
    bg: 'rgba(59,130,246,0.14)',
    border: 'rgba(59,130,246,0.3)',
    title: '高度コード',
    desc: '6th / 借用和音 / セカンダリードミナント / オンコード',
  },
  {
    glyph: '♫',
    color: '#f0918f',
    bg: 'rgba(239,68,68,0.13)',
    border: 'rgba(239,68,68,0.3)',
    title: '追加音色',
    desc: 'アコギ / エレキギター / ストリングス',
  },
  {
    glyph: '★',
    color: '#b9a6ff',
    bg: 'rgba(139,92,246,0.15)',
    border: 'rgba(139,92,246,0.35)',
    title: '追加プリセット',
    desc: '丸サ / Just The Two of Us / Pop Punk / 小室 / City Pop',
  },
];

export default function PaywallScreen() {
  const router = useRouter();

  return (
    <ScreenScaffold variant="paywall" padH={22}>
      {/* close */}
      <View style={styles.closeRow}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Icon name="close" size={15} color={colors.textSecondary} strokeWidth={2.6} />
        </Pressable>
      </View>

      {/* hero */}
      <View style={styles.hero}>
        <Image source={APP_ICON} style={styles.heroIcon} />
        <View style={styles.heroTitleRow}>
          <GradientText colors={rainbow} style={styles.heroTitle}>
            Palette
          </GradientText>
          <Text style={styles.heroTitle}> Pro</Text>
        </View>
        <Text style={styles.heroSub}>もっと自由に、もっと深く。</Text>
      </View>

      {/* price card */}
      <LinearGradient colors={rainbow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }} style={styles.priceBorder}>
        <View style={styles.priceInner}>
          <LinearGradient colors={['#7c4dff', '#d6409f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.priceIcon}>
            <Icon name="crown" size={24} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <View style={styles.priceLine}>
              <Text style={styles.priceKind}>買い切り</Text>
              <Text style={styles.priceValue}>¥490</Text>
            </View>
            <Text style={styles.priceNote}>一度の購入でずっと使える</Text>
          </View>
          <Icon name="chevronRight" size={17} color={colors.textDim} strokeWidth={2.4} />
        </View>
      </LinearGradient>

      {/* perks */}
      <View style={{ gap: 11, marginTop: 14, marginBottom: 22 }}>
        {PERKS.map((p) => (
          <View key={p.title} style={styles.perkRow}>
            <View style={[styles.perkIcon, { backgroundColor: p.bg, borderColor: p.border }]}>
              <Text style={[styles.perkGlyph, { color: p.color }]}>{p.glyph}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.perkTitle}>{p.title}</Text>
              <Text style={styles.perkDesc}>{p.desc}</Text>
            </View>
            <Icon name="chevronRight" size={15} color="#556" strokeWidth={2.4} />
          </View>
        ))}
      </View>

      {/* purchase */}
      <Pressable>
        <LinearGradient
          colors={['#8b5cf6', '#5b8cff', '#22c55e', '#eab308', '#f97316', '#ef4444']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.3 }}
          style={styles.purchaseBtn}>
          <Text style={styles.purchaseText}>Palette Proを購入</Text>
        </LinearGradient>
      </Pressable>
      <Pressable style={styles.restore}>
        <Text style={styles.restoreText}>購入を復元する</Text>
      </Pressable>
      <Text style={styles.footer}>
        サブスクリプションではありません。{'\n'}買い切りで、追加課金なしでずっと使えます。
      </Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 4, paddingBottom: 8 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: { alignItems: 'center', marginBottom: 22 },
  heroIcon: {
    width: 92,
    height: 92,
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#7c4dff',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
  },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { fontSize: 30, fontFamily: font.black, fontWeight: '900', color: colors.textPrimary },
  heroSub: { fontSize: 15, color: colors.textTertiary, fontFamily: font.semibold, fontWeight: '600', marginTop: 8 },

  priceBorder: { borderRadius: radius['4xl'], padding: 1.5 },
  priceInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surfaceCard2,
    borderRadius: 19,
    paddingVertical: 17,
    paddingHorizontal: 18,
  },
  priceIcon: { width: 48, height: 48, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  priceKind: { fontSize: 13, color: colors.textMuted, fontFamily: font.semibold, fontWeight: '600' },
  priceValue: { fontSize: 24, fontFamily: font.black, fontWeight: '900', color: colors.textPrimary },
  priceNote: { fontSize: 11.5, color: colors.textDim, marginTop: 3 },

  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surfacePanelAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius['2xl'],
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  perkIcon: { width: 46, height: 46, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  perkGlyph: { fontSize: 20 },
  perkTitle: { fontSize: 15, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },
  perkDesc: { fontSize: 11, color: colors.textDim, marginTop: 3, lineHeight: 16 },

  purchaseBtn: {
    borderRadius: radius['2xl'],
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  purchaseText: {
    fontSize: 16.5,
    fontFamily: font.extrabold,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  restore: { alignItems: 'center', marginTop: 16 },
  restoreText: { fontSize: 13.5, color: '#8fa0c4', fontFamily: font.semibold, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 10.5, color: '#5a6478', marginTop: 14, lineHeight: 17 },
});

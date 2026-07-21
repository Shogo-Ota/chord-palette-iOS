import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { GradientText } from '@/components/GradientText';
import { Icon } from '@/components/Icon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/config/legal';
import { logger } from '@/lib/logger';
import { track } from '@/services/analytics';
import { billingService, type BillingProduct } from '@/services/billing';
import { colors, font, radius, rainbow } from '@/theme/tokens';

const APP_ICON = require('../../assets/icon/app-icon.png');

/**
 * Fallback price shown until the provider's localized offering resolves. Kept in
 * sync with the App Store price point (¥500 — Apple has no ¥490 JPY tier). The
 * live price always comes from the store (`product.priceString`); this only shows
 * briefly before offerings load or if they fail to resolve.
 */
const FALLBACK_PRICE = '¥500';
const PERIOD_SUFFIX = '/ 月';

type Perk = { glyph: string; color: string; bg: string; border: string; title: string; desc: string; included: boolean };
const PERKS: Perk[] = [
  {
    glyph: '♪',
    color: colors.blueText,
    bg: 'rgba(91,140,255,0.14)',
    border: 'rgba(91,140,255,0.32)',
    title: '高度コード',
    desc: '6th / 借用和音 / セカンダリードミナント / オンコード',
    included: true,
  },
  {
    glyph: '★',
    color: colors.purpleText,
    bg: 'rgba(124,92,255,0.15)',
    border: 'rgba(124,92,255,0.35)',
    title: '追加プリセット',
    desc: 'ジャンル別の本格コード進行プリセットを多数追加',
    included: true,
  },
  // NOTE: Do not advertise not-yet-available features on the paywall (App Store
  // Guideline 2.3.x). The "追加音色（予定）" perk is intentionally omitted until it
  // ships; re-add it here with `included: true` when the feature is live.
];

type Status = 'idle' | 'purchasing' | 'restoring' | 'success' | 'error';

export default function PaywallScreen() {
  const router = useRouter();
  const [product, setProduct] = useState<BillingProduct | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Anonymous paywall-view event (once per screen mount).
  useEffect(() => {
    track('paywall_viewed');
  }, []);

  // Load the localized subscription price from the provider (never hardcoded).
  useEffect(() => {
    let active = true;
    billingService
      .getOfferings()
      .then((products) => {
        if (active && products.length > 0) setProduct(products[0]);
      })
      .catch((e) => logger.error('Failed to load offerings', { error: String(e) }));
    return () => {
      active = false;
    };
  }, []);

  const busy = status === 'purchasing' || status === 'restoring';
  const priceString = product?.priceString ?? FALLBACK_PRICE;

  const openLegal = (url: string) => {
    WebBrowser.openBrowserAsync(url).catch((e) =>
      logger.error('Failed to open legal link', { error: String(e) }),
    );
  };

  const closeSoon = () => {
    setStatus('success');
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }, 650);
  };

  const handlePurchase = async () => {
    if (busy) return;
    setErrorMsg('');
    setStatus('purchasing');
    try {
      const result = await billingService.purchasePro();
      if (result.status === 'purchased' || result.status === 'restored') {
        closeSoon();
      } else if (result.status === 'cancelled') {
        setStatus('idle');
      } else {
        setErrorMsg(result.message);
        setStatus('error');
      }
    } catch (e) {
      setErrorMsg('予期しないエラーが発生しました。');
      logger.error('Purchase failed', { error: String(e) });
      setStatus('error');
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setErrorMsg('');
    setStatus('restoring');
    try {
      const result = await billingService.restore();
      if (result.status === 'restored' || result.status === 'purchased') {
        closeSoon();
      } else if (result.status === 'cancelled') {
        setStatus('idle');
      } else {
        setErrorMsg(result.message);
        setStatus('error');
      }
    } catch (e) {
      setErrorMsg('予期しないエラーが発生しました。');
      logger.error('Restore failed', { error: String(e) });
      setStatus('error');
    }
  };

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
              <Text style={styles.priceKind}>月額サブスク</Text>
              <Text style={styles.priceValue}>{priceString}</Text>
              <Text style={styles.pricePeriod}>{PERIOD_SUFFIX}</Text>
            </View>
            <Text style={styles.priceNote}>自動更新・いつでも解約可能</Text>
          </View>
        </View>
      </LinearGradient>

      {/* perks */}
      <View style={{ gap: 11, marginTop: 14, marginBottom: 22 }}>
        {PERKS.map((p) => (
          <View key={p.title} style={[styles.perkRow, !p.included && styles.perkRowSoon]}>
            <View style={[styles.perkIcon, { backgroundColor: p.bg, borderColor: p.border }]}>
              <Text style={[styles.perkGlyph, { color: p.color }]}>{p.glyph}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.perkTitle, !p.included && styles.perkTitleSoon]}>{p.title}</Text>
              <Text style={styles.perkDesc}>{p.desc}</Text>
            </View>
            {p.included ? (
              <View style={styles.perkCheck}>
                <Icon name="check" size={13} color={colors.success} strokeWidth={2.8} />
              </View>
            ) : (
              <View style={styles.perkSoonPill}>
                <Text style={styles.perkSoonText}>予定</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* purchase */}
      <Pressable onPress={handlePurchase} disabled={busy || status === 'success'}>
        <LinearGradient
          colors={
            status === 'success'
              ? [colors.success, colors.success]
              : ['#8b5cf6', '#5b8cff', '#22c55e', '#eab308', '#f97316', '#ef4444']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.3 }}
          style={[
            styles.purchaseBtn,
            status === 'success' && styles.purchaseBtnSuccess,
            busy && styles.purchaseBtnBusy,
          ]}>
          {status === 'purchasing' ? (
            <View style={styles.btnRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.purchaseText}>登録処理中…</Text>
            </View>
          ) : status === 'success' ? (
            <View style={styles.btnRow}>
              <Icon name="check" size={18} color="#fff" strokeWidth={2.8} />
              <Text style={styles.purchaseText}>登録が完了しました</Text>
            </View>
          ) : (
            <Text style={styles.purchaseText}>Palette Pro に登録する（{priceString} {PERIOD_SUFFIX}）</Text>
          )}
        </LinearGradient>
      </Pressable>

      {status === 'error' && errorMsg !== '' && (
        <View style={styles.errorBox}>
          <View style={styles.errorBadge}>
            <Icon name="close" size={11} color={colors.white} strokeWidth={3} />
          </View>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <Pressable style={styles.restore} onPress={handleRestore} disabled={busy || status === 'success'}>
        {status === 'restoring' ? (
          <View style={styles.btnRow}>
            <ActivityIndicator color={colors.textMuted} size="small" />
            <Text style={styles.restoreText}>復元中…</Text>
          </View>
        ) : (
          <Text style={styles.restoreText}>購入を復元する</Text>
        )}
      </Pressable>

      <Text style={styles.footer}>
        Palette Pro は月額 {priceString} の自動更新サブスクリプションです。料金は購入確定時に
        Apple ID に請求されます。現在の期間終了の24時間前までに自動更新をオフにしない限り自動的に
        更新され、更新料金（{priceString} / 月）は期間終了前の24時間以内に請求されます。{'\n'}
        購入後は App Store のアカウント設定からいつでも管理・解約でき、解約すると現在の請求期間の
        終了時に Pro 機能が無効になります。
      </Text>

      <View style={styles.legalRow}>
        <Pressable hitSlop={8} onPress={() => openLegal(TERMS_OF_USE_URL)}>
          <Text style={styles.legalLink}>利用規約</Text>
        </Pressable>
        <Text style={styles.legalDot}>・</Text>
        <Pressable hitSlop={8} onPress={() => openLegal(PRIVACY_POLICY_URL)}>
          <Text style={styles.legalLink}>プライバシーポリシー</Text>
        </Pressable>
      </View>
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
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  priceKind: { fontSize: 13, color: colors.textMuted, fontFamily: font.semibold, fontWeight: '600' },
  priceValue: { fontSize: 24, fontFamily: font.black, fontWeight: '900', color: colors.textPrimary },
  pricePeriod: { fontSize: 13, color: colors.textMuted, fontFamily: font.semibold, fontWeight: '600' },
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
  perkRowSoon: { backgroundColor: colors.surfaceLocked, borderColor: colors.borderFaint },
  perkIcon: { width: 46, height: 46, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  perkGlyph: { fontSize: 20 },
  perkTitle: { fontSize: 15, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },
  perkTitleSoon: { color: colors.textMuted },
  perkDesc: { fontSize: 11, color: colors.textDim, marginTop: 3, lineHeight: 16 },
  perkCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkSoonPill: {
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  perkSoonText: { fontSize: 10, color: colors.textDim, fontFamily: font.semibold, fontWeight: '600' },

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
  purchaseBtnBusy: { opacity: 0.8 },
  purchaseBtnSuccess: { shadowColor: colors.success, shadowOpacity: 0.55 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.32)',
    borderRadius: radius.lg,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginTop: 12,
  },
  errorBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { flex: 1, fontSize: 12.5, color: colors.dangerSoft, fontFamily: font.semibold, fontWeight: '600', lineHeight: 17 },
  purchaseText: {
    fontSize: 16.5,
    fontFamily: font.extrabold,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  restore: { alignItems: 'center', marginTop: 18, paddingVertical: 6 },
  restoreText: { fontSize: 13.5, color: colors.textMuted, fontFamily: font.semibold, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 10.5, color: colors.textFaint, marginTop: 14, lineHeight: 17 },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingBottom: 4,
  },
  legalLink: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontFamily: font.semibold,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalDot: { fontSize: 11.5, color: colors.textFaint },
});

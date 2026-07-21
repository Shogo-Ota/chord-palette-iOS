import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { colors, font, radius } from '@/theme/tokens';

/**
 * Lightweight, non-blocking upsell toast for "preview-only" (試聴のみ) Pro content.
 *
 * Free users can audition Pro chords/presets but cannot bring them into the editor.
 * When they tap a locked item we play the sound and surface this toast — tapping it
 * opens the paywall. It never blocks the audition, so it stays out of the way while
 * keeping an upgrade path one tap away.
 *
 * Presentational only: the parent owns visibility via {@link useUpsellToast} and the
 * upgrade navigation via `onPress`, so this component carries no business logic.
 */
export function UpsellToast({
  message,
  onPress,
}: {
  message: string | null;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return (
    <Pressable
      style={[styles.toast, { bottom: insets.bottom + 20 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${message}。タップでPalette Proの詳細へ`}>
      <Icon name="lock" size={13} color={colors.gold} strokeWidth={2.4} />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
      <Text style={styles.cta}>Proを見る</Text>
    </Pressable>
  );
}

/**
 * State/lifecycle for {@link UpsellToast}. `show(message)` displays it and auto-hides
 * after `timeoutMs`; repeated calls reset the timer. The timer is cleared on unmount.
 */
export function useUpsellToast(timeoutMs = 2800) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const show = useCallback(
    (msg: string) => {
      setMessage(msg);
      clear();
      timer.current = setTimeout(() => setMessage(null), timeoutMs);
    },
    [clear, timeoutMs],
  );

  const hide = useCallback(() => {
    clear();
    setMessage(null);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { message, show, hide };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(30,24,54,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(200,162,74,0.45)',
    borderRadius: radius.xl,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cta: {
    fontSize: 12,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.goldText,
  },
});

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { colors, font, radius, spacing, typeSize } from '@/theme/tokens';

export type CPCoachMarksProps = {
  visible: boolean;
  /** Called when the user taps "はじめる" or the backdrop. Persist the seen flag here. */
  onDismiss: () => void;
};

type Step = { icon: IconName; title: string; body: string };

/**
 * First-run editor coach marks. A one-time, dismissible overlay that teaches the
 * three core interactions ("tap to audition → + to add → ▶ to play") so a brand
 * new user understands the flow within seconds. Purely presentational: the parent
 * owns visibility + persistence (see `sessionPrefsRepository`), so this component
 * carries no state and is safe to unmount immediately after dismissal.
 */
const STEPS: Step[] = [
  { icon: 'play', title: 'コードを試聴', body: '下のライブラリのコードをタップすると、その場で音が鳴ります。' },
  { icon: 'plus', title: '進行に追加', body: '「＋」で選んだコードを進行に足していきます。' },
  { icon: 'loop', title: 'まとめて再生', body: '▶ 再生で伴奏とドラム付きの進行を聴けます。' },
];

export function CPCoachMarks({ visible, onDismiss }: CPCoachMarksProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="チュートリアルを閉じる">
        {/* Stop propagation so taps inside the card don't dismiss. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.kicker}>はじめかた</Text>
          <Text style={styles.title}>3ステップで曲づくり</Text>

          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.stepRow}>
                <View style={styles.badge}>
                  <Icon name={s.icon} size={20} color={colors.primaryBlue} />
                  <View style={styles.numDot}>
                    <Text style={styles.numText}>{i + 1}</Text>
                  </View>
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                  <Text style={styles.stepBody}>{s.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            style={styles.cta}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="チュートリアルを閉じてはじめる">
            <Text style={styles.ctaText}>はじめる</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,6,12,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.s24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.s24,
    gap: spacing.s16,
  },
  kicker: {
    fontFamily: font.bold,
    fontSize: typeSize.caption,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.primaryBlue,
  },
  title: {
    fontFamily: font.extrabold,
    fontSize: 22,
    color: colors.textBright,
  },
  steps: { gap: spacing.s16, marginTop: spacing.s4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s16 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numDot: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontFamily: font.bold, fontSize: 10, color: colors.white },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { fontFamily: font.bold, fontSize: 15, color: colors.textPrimary },
  stepBody: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  cta: {
    marginTop: spacing.s8,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: font.extrabold, fontSize: 16, color: colors.white },
});

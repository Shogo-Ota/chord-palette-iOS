import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { colors, font, radius } from '@/theme/tokens';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Root error boundary. Catches render-time errors, logs them, and shows a
 * dark-themed fallback with a retry action instead of a white crash screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('Unhandled UI error', {
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const userMessage =
      error instanceof AppError ? error.userMessage : '予期しないエラーが発生しました。';

    return (
      <View style={styles.container}>
        <Text style={styles.title}>問題が発生しました</Text>
        <Text style={styles.message}>{userMessage}</Text>
        <Pressable style={styles.button} onPress={this.reset} hitSlop={8}>
          <Text style={styles.buttonText}>もう一度試す</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
    backgroundColor: colors.screenBg,
  },
  title: { fontSize: 18, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },
  message: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  button: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { fontSize: 14, fontFamily: font.semibold, fontWeight: '600', color: colors.purpleSoft },
});

import {
  NotoSansJP_400Regular,
  NotoSansJP_500Medium,
  NotoSansJP_600SemiBold,
  NotoSansJP_700Bold,
  NotoSansJP_800ExtraBold,
  NotoSansJP_900Black,
  useFonts,
} from '@expo-google-fonts/noto-sans-jp';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import * as session from '@/features/editor/session';
import { logger } from '@/lib/logger';
import {
  getDrumBeat,
  getDrumMode,
  getInstrumentEffect,
  getOctaveShift,
} from '@/repositories/sessionPrefsRepository';
import { track, initAnalytics } from '@/services/analytics';
import { billingService } from '@/services/billing';
import { initMonitoring } from '@/services/monitoring';
import { colors } from '@/theme/tokens';

// Initialize crash/error monitoring and anonymous analytics before the first render
// (both no-op in dev/tests and when unconfigured).
initMonitoring();
initAnalytics();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    NotoSansJP_400Regular,
    NotoSansJP_500Medium,
    NotoSansJP_600SemiBold,
    NotoSansJP_700Bold,
    NotoSansJP_800ExtraBold,
    NotoSansJP_900Black,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  // Anonymous app-open event (once per launch).
  useEffect(() => {
    track('app_opened');
  }, []);

  // Initialize billing once at startup so entitlements are resolved before the
  // first Pro-gated interaction (init logic stays in the service, not screens).
  useEffect(() => {
    billingService
      .initBilling()
      .catch((e) => logger.error('Billing init failed', { error: String(e) }));
  }, []);

  // Read legacy effect preferences at boot. The editor's public release policy
  // normalizes unapproved releaseCut values to sustain before first playback.
  useEffect(() => {
    getInstrumentEffect()
      .then((effect) => session.setInstrumentEffect(effect))
      .catch((e) => logger.error('Instrument-effect restore failed', { error: String(e) }));
    getOctaveShift()
      .then((octaves) => session.setOctaveShift(octaves))
      .catch((e) => logger.error('Octave-shift restore failed', { error: String(e) }));
    getDrumMode()
      .then((mode) => session.setDrumMode(mode))
      .catch((e) => logger.error('Drum-mode restore failed', { error: String(e) }));
    getDrumBeat()
      .then((beat) => session.setDrumBeat(beat))
      .catch((e) => logger.error('Drum-beat restore failed', { error: String(e) }));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.screenBg },
              animation: 'slide_from_right',
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="editor" />
            <Stack.Screen name="presets" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="groove" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="export" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen
              name="paywall"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

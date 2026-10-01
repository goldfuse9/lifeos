import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/state/session';
import { usePendingLink } from '@/state/deepLink';
import { Backdrop, T, ToastProvider } from '@/ui/kit';
import { C } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Kořen: písmo (přibalené v aplikaci, žádné stahování z Google Fonts),
 * relace a tři oddělené větve navigace podle stavu účtu.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            {fontsLoaded ? <Gate /> : null}
          </ToastProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Gate() {
  const { status, covered } = useSession();
  usePendingLink(status);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'loading') return null;

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={status === 'welcome' || status === 'onboarding'}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'locked'}>
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'unlocked'}>
          <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
      {covered ? <PrivacyCover /> : null}
    </View>
  );
}

/** V přepínači aplikací se nemá ukázat obsah karty. */
function PrivacyCover() {
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <Backdrop />
      <T style={{ fontSize: 20, letterSpacing: -0.6, color: C.ink }}>
        <T w="semibold" style={{ fontSize: 20 }}>Life</T>
        <T style={{ fontSize: 20, color: C.muted }}>OS</T>
      </T>
    </View>
  );
}

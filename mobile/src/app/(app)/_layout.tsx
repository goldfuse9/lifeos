import React, { useCallback } from 'react';
import { Stack, router } from 'expo-router';
import { useReminderTap } from '@/platform/notifications';
import { useSession } from '@/state/session';

/**
 * Navigace za zámkem. Přehled je rozcestník (jako na plátně); podstránky
 * se otevírají kartou zprava, formuláře a zápis zespodu jako list.
 */
export default function AppLayout() {
  const { data, person } = useSession();
  // Pojistka pro okamžik zamčení: obrazovky za zámkem se bez dat nevykreslí.
  if (!data || !person) return null;
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="osa" />
        <Stack.Screen name="kalendar" />
        <Stack.Screen name="dokumenty" />
        <Stack.Screen name="nouze" />
        <Stack.Screen name="lekari" />
        <Stack.Screen name="cyklus/index" />
        <Stack.Screen name="leky/index" />
        <Stack.Screen name="tapeta" />
        <Stack.Screen name="skener" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ockovani/index" />
        <Stack.Screen name="ockovani/upravit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="leky/upravit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="cyklus/zapis" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="cyklus/nastaveni" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="zaznam/[id]" />
        <Stack.Screen name="zaznam/upravit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="priloha/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="zapis" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="nastaveni" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <ReminderTap />
    </>
  );
}

/** Klepnutí na připomínku otevře termín (i po odemknutí). */
function ReminderTap() {
  const open = useCallback((d: { recordId?: string; screen?: string }) => {
    if (d.screen === 'leky') router.push('/leky');
    else if (d.recordId) router.push(`/zaznam/${d.recordId}`);
  }, []);
  useReminderTap(open);
  return null;
}

import { Stack } from 'expo-router';
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
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="osa" />
      <Stack.Screen name="kalendar" />
      <Stack.Screen name="dokumenty" />
      <Stack.Screen name="nouze" />
      <Stack.Screen name="lekari" />
      <Stack.Screen name="hledat" options={{ animation: 'fade' }} />
      <Stack.Screen name="zaznam/[id]" />
      <Stack.Screen name="zaznam/upravit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="priloha/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="zapis" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="nastaveni" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

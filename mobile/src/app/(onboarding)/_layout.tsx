import { Stack } from 'expo-router';

/** Úvod a registrace. Adresa „/“ patří Přehledu, proto se úvod jmenuje „vitejte“. */
export const unstable_settings = { initialRouteName: 'vitejte' };

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="vitejte" />
      <Stack.Screen name="register" />
    </Stack>
  );
}

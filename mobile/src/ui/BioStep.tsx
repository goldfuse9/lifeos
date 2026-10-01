import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSession } from '@/state/session';
import { Backdrop, Card, H1, Muted, PrimaryButton, SecondaryButton, T, useScreenInsets } from './kit';
import { C } from './theme';
import { IconFace, IconFingerprint } from './icons';

/** Krok po registraci nebo obnově: zapnout odemykání biometrií? */
export function BioStep({ restored }: { restored?: boolean }) {
  const s = useSession();
  const ins = useScreenInsets();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bio = s.bio;
  const can = !!bio?.available && !!bio?.enrolled;

  const finish = async (enable: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      await s.finishOnboarding(enable);
    } catch {
      setErr('Biometrii se nepodařilo zapnout. Můžete to zkusit později v nastavení.');
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 44, paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 }}>
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Rychlé odemykání</H1>
          <Muted style={{ marginTop: 4 }}>{restored ? 'Data jsou obnovená. Ještě jedna věc.' : 'Účet je vytvořený. Ještě jedna věc.'}</Muted>
        </View>
        <Card style={{ marginTop: 16, padding: 20, alignItems: 'center', gap: 12 }}>
          <View style={{ width: 64, height: 64, borderRadius: 24, backgroundColor: '#E8EFFD', alignItems: 'center', justifyContent: 'center' }}>
            {bio?.kind === 'fingerprint' ? <IconFingerprint size={30} color="#3B6FE0" width={1.6} /> : <IconFace size={30} color="#3B6FE0" width={1.6} />}
          </View>
          <T w="semibold" style={{ fontSize: 18, textAlign: 'center' }}>
            {can ? `Odemykat přes ${bio!.label}?` : 'Biometrie není k dispozici'}
          </T>
          <Muted style={{ textAlign: 'center' }}>
            {can
              ? 'Klíč k datům se uloží do zabezpečeného čipu telefonu a vydá se jen po ověření. Heslo zůstává jako záloha.'
              : 'Telefon nemá nastavené Face ID ani otisk prstu. Budete se přihlašovat heslem; biometrii jde zapnout později v nastavení.'}
          </Muted>
        </Card>
        {err ? <T style={{ marginTop: 12, color: C.danger, fontSize: 14 }}>{err}</T> : null}
        <View style={{ flex: 1 }} />
        <View style={{ marginTop: 24, gap: 10 }}>
          {can ? <PrimaryButton label={`Zapnout ${bio!.label}`} onPress={() => finish(true)} busy={busy} /> : null}
          <SecondaryButton label={can ? 'Teď ne' : 'Pokračovat'} onPress={() => finish(false)} />
        </View>
      </ScrollView>
    </View>
  );
}

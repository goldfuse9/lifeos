import React, { useState } from 'react';
import { Linking, Platform, ScrollView, Share, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad, useNow } from '@/state/useLoad';
import { VYZV_KDY, pickupOptions, smsUrl, vyzvText } from '@/domain/skolka';
import { toLocalDate, toLocalTime } from '@/domain/dates';
import { Backdrop, Card, Chip, H1, LinkButton, Loading, Muted, PrimaryButton, T, TopBar, useToast } from '@/ui/kit';
import { C } from '@/ui/theme';

/**
 * Dnes vyzvedne někdo jiný. Nabízí jen pověřené osoby — kdo v seznamu
 * není, toho školka dítě stejně nevydá, takže sem psát nepatří.
 */
export default function SkolkaVyzvedne() {
  const data = useData();
  const person = usePerson();
  const { account, touch } = useSession();
  const toast = useToast();
  const now = useNow();
  const today = toLocalDate(now);
  const [who, setWho] = useState<string | null>(null);
  const [kdy, setKdy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { value: sk } = useLoad(() => data.personData.get(person.id, 'skolka'), [person.id]);

  if (!sk) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <View style={{ paddingTop: Platform.OS === 'ios' ? 20 : 48, paddingHorizontal: 16 }}>
          <TopBar title={person.name} backLabel="Zavřít" />
          <Loading />
        </View>
      </View>
    );
  }

  const options = pickupOptions(sk);
  const ready = !!who && !!kdy;
  const text = ready ? vyzvText({ child: person.name, who: who!, kdy: kdy!, parent: account?.name.split(/\s+/)[0] ?? null }) : '';

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await data.records.create(person.id, { type: 'note', title: 'Ze školky vyzvedne ' + who, description: kdy!, date: today, time: toLocalTime(now), metadata: { skolka: 'vyzvednuti', place: sk.name } });
      touch();
      if (sk.phone) await Linking.openURL(smsUrl(sk.phone, text, Platform.OS === 'ios'));
      else await Share.share({ message: text });
      toast('Zapsáno do osy');
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 20 : 48, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} backLabel="Zavřít" />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>Dnes vyzvedne</H1>
        <Muted style={{ marginTop: 4, paddingLeft: 8 }}>{sk.name}</Muted>

        {options.length ? (
          <>
            <T w="semibold" style={{ marginTop: 20, paddingLeft: 4, fontSize: 13, color: C.muted }}>Kdo</T>
            <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {options.map((p) => (
                <Chip key={p} label={p} selected={who === p} onPress={() => setWho(who === p ? null : p)} />
              ))}
            </View>
            <LinkButton style={{ marginLeft: 4 }} label="Upravit pověřené osoby" onPress={() => router.push('/skolka/nastavit')} />

            <T w="semibold" style={{ marginTop: 12, paddingLeft: 4, fontSize: 13, color: C.muted }}>Kdy</T>
            <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {VYZV_KDY.map((k) => (
                <Chip key={k} label={k} selected={kdy === k} onPress={() => setKdy(kdy === k ? null : k)} />
              ))}
            </View>

            {ready ? (
              <Card style={{ marginTop: 20, padding: 14, borderRadius: 20 }}>
                <T w="semibold" style={{ fontSize: 12, color: C.muted }}>{sk.phone ? 'SMS do školky' : 'Zpráva'}</T>
                <T style={{ marginTop: 4, fontSize: 14, lineHeight: 20 }}>{text}</T>
              </Card>
            ) : null}

            <PrimaryButton style={{ marginTop: 24 }} label={ready ? (sk.phone ? 'Poslat SMS školce' : 'Poslat školce') : 'Vyberte kdo a kdy'} disabled={!ready} busy={busy} onPress={send} />
          </>
        ) : (
          <Card style={{ marginTop: 16, padding: 16, borderRadius: 24 }}>
            <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Zatím tu nikdo není</T>
            <T style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: C.muted }}>Přidejte babičku, dědu nebo chůvu — školka vydá dítě jen osobám, které jste jí nahlásili.</T>
            <PrimaryButton style={{ marginTop: 14 }} label="Přidat pověřené osoby" onPress={() => router.push('/skolka/nastavit')} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

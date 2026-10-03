import React, { useState } from 'react';
import { Linking, Platform, ScrollView, Share, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad, useNow } from '@/state/useLoad';
import { OMLUVA_KDY, OMLUVA_PROC, omluvaDays, omluvaText, smsUrl, type OmluvaKdy } from '@/domain/skolka';
import { toLocalDate } from '@/domain/dates';
import { Backdrop, Card, Chip, H1, Loading, Muted, PrimaryButton, T, TopBar, useToast } from '@/ui/kit';
import { C } from '@/ui/theme';

/**
 * Omluvenka — dvě volby (kdy, proč), nic se nepíše. Text vidí rodič
 * celý dřív, než ho pošle; do osy se zapíše jako poznámka na každý den.
 */
export default function SkolkaOmluvit() {
  const data = useData();
  const person = usePerson();
  const { account, touch } = useSession();
  const toast = useToast();
  const today = toLocalDate(useNow());
  const [kdy, setKdy] = useState<OmluvaKdy | null>(null);
  const [proc, setProc] = useState<string | null>(null);
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

  const ready = !!kdy && !!proc;
  const days = kdy ? omluvaDays(kdy, today) : [];
  const text = ready ? omluvaText({ child: person.name, days, proc: proc!, parent: account?.name.split(/\s+/)[0] ?? null }) : '';

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      for (const d of days) {
        await data.records.create(person.id, { type: 'note', title: 'Omluven ze školky', description: proc!, date: d, time: null, metadata: { skolka: 'omluvenka', place: sk.name } });
      }
      touch();
      if (sk.phone) await Linking.openURL(smsUrl(sk.phone, text, Platform.OS === 'ios'));
      else await Share.share({ message: text });
      toast('Omluvenka zapsána do osy');
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
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>Omluvit z docházky</H1>
        <Muted style={{ marginTop: 4, paddingLeft: 8 }}>{sk.name}</Muted>

        <T w="semibold" style={{ marginTop: 20, paddingLeft: 4, fontSize: 13, color: C.muted }}>Kdy</T>
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {OMLUVA_KDY.map(([k, l]) => (
            <Chip key={k} label={l} selected={kdy === k} onPress={() => setKdy(kdy === k ? null : k)} />
          ))}
        </View>

        <T w="semibold" style={{ marginTop: 20, paddingLeft: 4, fontSize: 13, color: C.muted }}>Proč</T>
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {OMLUVA_PROC.map((p) => (
            <Chip key={p} label={p} selected={proc === p} onPress={() => setProc(proc === p ? null : p)} />
          ))}
        </View>
        <T style={{ marginTop: 6, paddingLeft: 4, fontSize: 12, color: C.muted }}>Školka uvidí jen den a důvod, žádné podrobnosti.</T>

        {ready ? (
          <Card style={{ marginTop: 20, padding: 14, borderRadius: 20 }}>
            <T w="semibold" style={{ fontSize: 12, color: C.muted }}>{sk.phone ? 'SMS do školky' : 'Zpráva'}</T>
            <T style={{ marginTop: 4, fontSize: 14, lineHeight: 20 }}>{text}</T>
          </Card>
        ) : null}

        <PrimaryButton style={{ marginTop: 24 }} label={ready ? (sk.phone ? 'Poslat SMS školce' : 'Poslat omluvenku') : 'Vyberte kdy a proč'} disabled={!ready} busy={busy} onPress={send} />
      </ScrollView>
    </View>
  );
}

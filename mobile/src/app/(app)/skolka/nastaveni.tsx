import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useSkolka, useSkolkaDemo } from '@/state/useSkolka';
import { pickupOptions, shareOf } from '@/domain/skolka';
import { czIban } from '@/domain/skolkaFeed';
import { Card, Divider, Muted, Row, useToast } from '@/ui/kit';
import { SkLabel, SkolkaScreen } from '@/ui/SkolkaScreen';

/** Nastavení školky — vše, co dřív bylo v „Školka ví“, plus účet na platby a ukázka. */
export default function SkolkaNastaveni() {
  const toast = useToast();
  const { value } = useSkolka();
  const demo = useSkolkaDemo();
  const [busy, setBusy] = useState(false);
  if (!value) return <SkolkaScreen title="Nastavení" loading />;

  const { sk, feed } = value;
  const people = pickupOptions(sk);
  const share = shareOf(sk);
  const shared = [share.alergie && 'alergie', share.kontakty && 'kontakty na rodiče', share.poverene && 'kdo smí vyzvedávat', share.ockovani && 'očkování', share.anamneza && 'anamnéza'].filter(Boolean) as string[];
  const ucetOk = sk.ucet ? !!czIban(sk.ucet) : false;

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast(msg);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nepovedlo se.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SkolkaScreen title="Nastavení školky" sub={[sk.name, sk.trida].filter(Boolean).join(' · ')}>
      <SkLabel>Školka ví</SkLabel>
      <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
        <Row title="Školka, třída a značka" sub={[sk.name, sk.trida].filter(Boolean).join(' · ') || 'nenastaveno'} onPress={() => router.push('/skolka/nastavit')} />
        <Divider />
        <Row title="Kdo smí vyzvedávat" sub={people.length ? 'Rodiče, ' + people.join(', ') : 'Jen rodiče'} onPress={() => router.push('/skolka/nastavit')} />
        <Divider />
        <Row title="Co školka uvidí" sub={shared.length ? shared.join(', ') : 'nic'} onPress={() => router.push('/skolka/sdileni')} />
      </Card>

      <SkLabel>Platby a kontakt</SkLabel>
      <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
        <Row title="Účet na stravné" sub={sk.ucet ? sk.ucet + (sk.vs ? ' · VS ' + sk.vs : '') + (ucetOk ? '' : ' · neplatné číslo') : 'pro QR platbu'} warn={!!sk.ucet && !ucetOk} onPress={() => router.push('/skolka/nastavit')} />
        {sk.phone ? (
          <>
            <Divider />
            <Row title="Zavolat do školky" sub={sk.phone} onPress={() => Linking.openURL('tel:' + sk.phone!.replace(/\s+/g, ''))} />
          </>
        ) : null}
      </Card>

      <SkLabel>Ukázka</SkLabel>
      <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
        <Row title={feed.demo ? 'Poslat ukázkovou zprávu znovu' : 'Vyzkoušet ukázku'} sub="zprávy, akce, platby, fotky a dotazníky" onPress={() => run(() => demo.start(), 'Ukázka je tu — za 5 s přijde zpráva')} />
        {feed.demo ? (
          <>
            <Divider />
            <Row danger title="Odebrat ukázku" sub="smaže ukázková data i termíny v kalendáři" onPress={() => run(() => demo.remove(), 'Ukázka odebrána')} />
          </>
        ) : null}
      </Card>
      <View style={{ height: 8 }} />
      <Muted style={{ marginTop: 6, paddingHorizontal: 8, fontSize: 12, lineHeight: 17 }}>Zprávy, akce, platby a fotky bude posílat školka po propojení. Do té doby jsou jen ukázkou v tomto telefonu.</Muted>
    </SkolkaScreen>
  );
}

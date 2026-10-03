import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad, useNow } from '@/state/useLoad';
import { demoZprava, isSet, pickupOptions, shareOf, znackaOf, zpravaOf, zpravaRecord, zpravaSummary } from '@/domain/skolka';
import { notificationPermission, notifySchool } from '@/platform/notifications';
import { relativeDays, toLocalDate, toLocalTime } from '@/domain/dates';
import { Backdrop, Badge, BottomFade, Card, Divider, H1, Loading, Muted, Note, PrimaryButton, Row, SecondaryButton, SectionLabel, T, TopBar, useScreenInsets, useToast } from '@/ui/kit';
import { Znacka } from '@/ui/Znacka';
import { C } from '@/ui/theme';
import { IconPhone } from '@/ui/icons';
import type { HcRecord } from '@/domain/types';

/**
 * Školka — rodičovská strana. Podle desky „Telefon rodiče“ z plátna,
 * ve vzhledu aplikace: nahoře značka a co je dnes, pod tím co rodič
 * školce posílá (omluvenka, kdo vyzvedne, telefon) a kdo / co je
 * nastavené. Zprávy ze školky potřebují server — fáze 2.
 */
export default function Skolka() {
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const today = toLocalDate(useNow());
  const [sending, setSending] = useState(false);

  const { value } = useLoad(async () => {
    const [sk, notes] = await Promise.all([data.personData.get(person.id, 'skolka'), data.records.query({ personId: person.id, types: ['note'], order: 'desc', limit: 60 })]);
    const school = notes.filter((r) => !!r.metadata.skolka);
    return { sk, school };
  }, [person.id]);

  if (!value) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <View style={{ paddingTop: ins.top, paddingHorizontal: 16 }}>
          <TopBar title={person.name} />
          <Loading />
        </View>
      </View>
    );
  }

  const sk = value.sk;
  const z = znackaOf(sk.znacka);
  const todayItems = value.school.filter((r) => r.date === today);
  const later = value.school.filter((r) => r.date > today);
  const past = value.school.filter((r) => r.date < today && !zpravaOf(r)).slice(0, 5);
  const share = shareOf(sk);
  const sharedLabels = [share.alergie && 'alergie', share.kontakty && 'kontakty na rodiče', share.poverene && 'kdo smí vyzvedávat', share.ockovani && 'očkování', share.anamneza && 'anamnéza'].filter(Boolean) as string[];
  const people = pickupOptions(sk);
  const demoToday = value.school.find((r) => r.date === today && zpravaOf(r)?.demo);

  // Ukázka zprávy: zapíše se do telefonu a za pár vteřin přijde jako upozornění
  const tryDemo = async () => {
    setSending(true);
    try {
      let rec = demoToday;
      if (!rec) {
        const now = new Date();
        rec = await data.records.create(person.id, zpravaRecord(demoZprava(), toLocalDate(now), toLocalTime(now), sk.name));
        touch();
      }
      const z = zpravaOf(rec)!;
      if (await notificationPermission(true)) {
        await notifySchool({ recordId: rec.id, title: (sk.name ?? 'Školka') + ' · ' + person.name, body: zpravaSummary(z) + ' — ošetřeno. Klepněte pro celý zápis.', inSeconds: 5 });
        toast('Zamkněte telefon — zpráva přijde za 5 s');
      } else {
        router.push({ pathname: '/skolka/zprava', params: { id: rec.id } });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nepovedlo se.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} backLabel="Zpět na přehled" />

        <View style={{ marginTop: 18, paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 8px 20px rgba(40,40,40,0.08)', transform: [{ rotate: '-4deg' }] }}>
            <Znacka value={sk.znacka} size={50} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <H1>Školka</H1>
            <Muted style={{ marginTop: 2 }} numberOfLines={2}>
              {isSet(sk) ? [sk.name, sk.trida, z ? 'značka ' + z.name : null].filter(Boolean).join(' · ') : person.name + ' · zatím nenastaveno'}
            </Muted>
          </View>
        </View>

        {!isSet(sk) ? (
          <Card style={{ marginTop: 16, padding: 16, borderRadius: 24 }}>
            <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Kam {person.name} chodí do školky?</T>
            <T style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: C.muted }}>Stačí název a telefon. Pak odsud pošlete omluvenku nebo dáte vědět, kdo dnes vyzvedne.</T>
            <PrimaryButton style={{ marginTop: 14 }} label="Nastavit školku" onPress={() => router.push('/skolka/nastavit')} />
          </Card>
        ) : (
          <>
            {/* Dnes */}
            <SectionLabel>Dnes</SectionLabel>
            <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
              {todayItems.length ? (
                todayItems.map((r, i) => (
                  <View key={r.id}>
                    {i ? <Divider /> : null}
                    <SchoolRow r={r} today={today} />
                  </View>
                ))
              ) : (
                <View style={{ padding: 14 }}>
                  <T style={{ fontSize: 14, lineHeight: 20, color: C.muted }}>Nic zvláštního — vyzvedává {people.length ? 'rodič nebo pověřená osoba' : 'rodič'} jako obvykle.</T>
                </View>
              )}
            </Card>

            {/* Pro školku */}
            <SectionLabel>Pro školku</SectionLabel>
            <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
              <Row title="Omluvit z docházky" sub="nemoc, lékař, dovolená" onPress={() => router.push('/skolka/omluvit')} />
              <Divider />
              <Row title="Dnes vyzvedne někdo jiný" sub={people.length ? 'babička, děda… jen pověřené osoby' : 'nejdřív přidejte pověřené osoby'} onPress={() => router.push('/skolka/vyzvedne')} />
              {sk.phone ? (
                <>
                  <Divider />
                  <Row
                    title="Zavolat do školky"
                    sub={sk.phone}
                    onPress={() => Linking.openURL('tel:' + sk.phone!.replace(/\s+/g, ''))}
                    right={
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.okTint, alignItems: 'center', justifyContent: 'center' }}>
                        <IconPhone size={17} color={C.ok} width={1.9} />
                      </View>
                    }
                  />
                </>
              ) : null}
            </Card>

            {/* Zprávy ze školky — doručení potřebuje server (fáze 2), zatím ukázka */}
            <View style={{ marginTop: 12, padding: 14, borderRadius: 22, backgroundColor: 'rgba(59,111,224,0.07)', borderWidth: 1, borderColor: 'rgba(59,111,224,0.16)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <T w="semibold" style={{ fontSize: 14, lineHeight: 20, color: '#27407A' }}>Zprávy ze školky</T>
                  <T style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: '#27407A' }}>Teplota, úraz i jak proběhl den — hned, jak je učitelka zapíše.</T>
                </View>
                <Badge label="Připravujeme" bg="rgba(255,255,255,0.8)" fg="#27407A" />
              </View>
              <SecondaryButton style={{ marginTop: 12 }} label={sending ? 'Posílám…' : demoToday ? 'Poslat ukázku znovu' : 'Vyzkoušet ukázku'} onPress={() => (sending ? undefined : tryDemo())} />
            </View>

            {/* Nastavení */}
            <SectionLabel>Školka ví</SectionLabel>
            <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
              <Row title="Kdo smí vyzvedávat" sub={people.length ? 'Rodiče, ' + people.join(', ') : 'Jen rodiče'} onPress={() => router.push('/skolka/nastavit')} />
              <Divider />
              <Row title="Co školka uvidí" sub={sharedLabels.length ? sharedLabels.join(', ') : 'nic'} onPress={() => router.push('/skolka/sdileni')} />
              <Divider />
              <Row title="Školka a značka" sub={[sk.name, sk.trida].filter(Boolean).join(' · ')} onPress={() => router.push('/skolka/nastavit')} />
            </Card>

            {later.length || past.length ? <SectionLabel>Poslané školce</SectionLabel> : null}
            {later.length || past.length ? (
              <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
                {[...later, ...past].map((r, i) => (
                  <View key={r.id}>
                    {i ? <Divider /> : null}
                    <SchoolRow r={r} today={today} />
                  </View>
                ))}
              </Card>
            ) : null}

            <Note style={{ marginTop: 16 }}>Omluvenky a vyzvednutí se zapisují do osy a školce odcházejí jako SMS. Zbytek karty zůstává jen v telefonu.</Note>
          </>
        )}
      </ScrollView>
      <BottomFade />
    </View>
  );
}

function SchoolRow({ r, today }: { r: HcRecord; today: string }) {
  const kind = r.metadata.skolka;
  const z = zpravaOf(r);
  const dot = z ? C.orange : kind === 'omluvenka' ? C.purple : '#3B6FE0';
  const open = () => (z ? router.push({ pathname: '/skolka/zprava', params: { id: r.id } }) : router.push(`/zaznam/${r.id}`));
  return (
    <Pressable accessibilityRole="button" onPress={open} style={({ pressed }) => ({ minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pressed ? 'rgba(255,255,255,0.6)' : 'transparent' })}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{r.title}</T>
        <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{[relativeDays(r.date, today) + (z && r.time ? ' ' + r.time.replace(/^0/, '') : ''), r.description].filter(Boolean).join(' · ')}</T>
      </View>
      {z && !z.ackAt ? <Badge label="Nové" bg={C.orangeTint} fg={C.orangeInk} /> : null}
    </Pressable>
  );
}

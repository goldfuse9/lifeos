import React, { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad, useNow } from '@/state/useLoad';
import { ZAPIS_ALERT, smsUrl, vyzvDrivText, zpravaOf, type SkolkaZapis } from '@/domain/skolka';
import { relativeDays, toLocalDate } from '@/domain/dates';
import { Backdrop, Badge, BottomFade, Card, Divider, H1, Loading, Muted, Note, PrimaryButton, SecondaryButton, SectionLabel, T, TopBar, useScreenInsets, useToast } from '@/ui/kit';
import { Znacka } from '@/ui/Znacka';
import { C } from '@/ui/theme';
import { IconBandage, IconCheck, IconPhone, IconSms, IconThermo, IconTrash } from '@/ui/icons';
import { confirm } from '@/ui/device';
import { cancelSchool } from '@/platform/notifications';

/**
 * Zpráva ze školky — denní zápis učitelky. Nahoře to, kvůli čemu rodič
 * zbystří (teplota, úraz) i s tím, jak to školka ošetřila; pod tím
 * běžný den (jídlo, spaní) a dole, co může rodič hned udělat.
 */
const KIND = {
  teplota: { tint: C.orangeTint, fg: C.orangeInk, Icon: IconThermo },
  uraz: { tint: C.dangerTint, fg: C.danger, Icon: IconBandage },
} as const;

export default function SkolkaZprava() {
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const { account, touch } = useSession();
  const toast = useToast();
  const today = toLocalDate(useNow());
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bump, setBump] = useState(0);

  const { value } = useLoad(async () => {
    const [rec, sk] = await Promise.all([data.records.get(id), data.personData.get(person.id, 'skolka')]);
    return { rec, sk };
  }, [id, person.id, bump]);

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

  const z = value.rec ? zpravaOf(value.rec) : null;
  if (!value.rec || !z) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <View style={{ paddingTop: ins.top, paddingHorizontal: 16 }}>
          <TopBar title={person.name} backLabel="Školka" />
          <Muted style={{ marginTop: 24, paddingLeft: 8 }}>Zpráva už není k dispozici.</Muted>
        </View>
      </View>
    );
  }

  const rec = value.rec;
  const sk = value.sk;
  const alerts = z.items.filter((i) => ZAPIS_ALERT.includes(i.kind)).sort((a, b) => a.time.localeCompare(b.time));
  const day = z.items.filter((i) => !ZAPIS_ALERT.includes(i.kind)).sort((a, b) => a.time.localeCompare(b.time));
  const parent = account?.name.split(/\s+/)[0] ?? null;
  const when = relativeDays(rec.date, today) + (rec.time ? ' ' + rec.time.replace(/^0/, '') : '');

  const ack = async () => {
    await data.records.update(rec.id, { metadata: { ...rec.metadata, zprava: { ...z, ackAt: new Date().toISOString() } } });
    touch();
    setBump((b) => b + 1);
    toast('Potvrzeno');
  };

  // Ukázka leží ve skutečné kartě dítěte. Obecný detail záznamu sem
  // přesměrovává, takže smazat se musí dát tady — jinak by vymyšlená
  // teplota a úraz zůstaly v ose napořád.
  const removeDemo = async () => {
    if (!(await confirm('Smazat ukázku?', 'Zmizí z osy i ze školky. Opravdové údaje dítěte to neovlivní.', 'Smazat'))) return;
    await cancelSchool(rec.id).catch(() => {});
    await data.records.softDelete(rec.id);
    touch();
    toast('Ukázka smazána');
    if (router.canGoBack()) router.back();
    else router.replace('/skolka');
  };

  const sms = (body: string) => {
    if (!sk.phone) {
      toast('Doplňte telefon školky v nastavení');
      return;
    }
    Linking.openURL(smsUrl(sk.phone, body, Platform.OS === 'ios'));
  };

  const ackTime = z.ackAt ? new Date(z.ackAt) : null;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} backLabel="Školka" />

        <View style={{ marginTop: 18, paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 8px 20px rgba(40,40,40,0.08)', transform: [{ rotate: '-4deg' }] }}>
            <Znacka value={sk.znacka} size={44} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <H1>Ze školky</H1>
              {z.demo ? <Badge label="Ukázka" /> : null}
            </View>
            <Muted style={{ marginTop: 2 }} numberOfLines={2}>{[when, z.from, sk.name].filter(Boolean).join(' · ')}</Muted>
          </View>
        </View>

        {/* Co je potřeba vědět */}
        {alerts.map((i) => (
          <AlertCard key={i.kind + i.time} i={i} />
        ))}

        {/* Běžný den */}
        {day.length ? (
          <>
            <SectionLabel>Jak proběhl den</SectionLabel>
            <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
              {day.map((i, n) => (
                <View key={i.kind + i.time}>
                  {n ? <Divider /> : null}
                  <View style={{ minHeight: 56, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <T style={{ width: 42, fontSize: 13, color: C.muted, fontVariant: ['tabular-nums'] }}>{i.time.replace(/^0/, '')}</T>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{i.title}{i.value ? <T style={{ fontSize: 15, color: C.muted }}>{' · ' + i.value}</T> : null}</T>
                      {i.text ? <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{i.text}</T> : null}
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {/* Co rodič udělá */}
        <SectionLabel>Co uděláte</SectionLabel>
        {ackTime ? (
          <View style={{ minHeight: 52, paddingHorizontal: 16, borderRadius: 26, backgroundColor: C.okTint, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconCheck size={18} color={C.ok} width={2.4} />
            <T w="semibold" style={{ fontSize: 15, color: '#125742' }}>Přečteno {ackTime.getHours()}:{String(ackTime.getMinutes()).padStart(2, '0')}</T>
          </View>
        ) : (
          <PrimaryButton label="Beru na vědomí" onPress={ack} />
        )}
        <View style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}>
          <Action label="Vyzvednu dřív" Icon={IconSms} onPress={() => sms(vyzvDrivText({ child: person.name, parent }))} />
          <Action label="Zavolat" Icon={IconPhone} onPress={() => (sk.phone ? Linking.openURL('tel:' + sk.phone.replace(/\s+/g, '')) : toast('Doplňte telefon školky v nastavení'))} />
          {alerts.some((i) => i.kind === 'teplota') ? <Action label="Změřit doma" Icon={IconThermo} onPress={() => router.push('/zapis')} /> : null}
        </View>

        <Note style={{ marginTop: 16 }}>
          {z.demo
            ? 'Ukázka, jak budou chodit zprávy ze školky. Skutečné zprávy začnou chodit po propojení se školkou — potvrzení přečtení pak uvidí i učitelka.'
            : 'Zpráva je uložená v ose. Potvrzení přečtení uvidí učitelka.'}
        </Note>
        {z.demo ? <SecondaryButton style={{ marginTop: 16 }} danger label="Smazat ukázku" icon={<IconTrash size={16} color={C.danger} width={1.8} />} onPress={removeDemo} /> : null}
      </ScrollView>
      <BottomFade />
    </View>
  );
}

function AlertCard({ i }: { i: SkolkaZapis }) {
  const k = KIND[i.kind as keyof typeof KIND];
  return (
    <Card style={{ marginTop: 12, padding: 16, borderRadius: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: k.tint, alignItems: 'center', justifyContent: 'center' }}>
          <k.Icon size={22} color={k.fg} width={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T w="semibold" style={{ fontSize: 17, lineHeight: 22 }}>{i.title}</T>
          <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{i.time.replace(/^0/, '')}{i.value && !/\d/.test(i.value) ? ' · ' + i.value : ''}</T>
        </View>
        {i.value && /\d/.test(i.value) ? <T w="semibold" style={{ fontSize: 22, color: k.fg, fontVariant: ['tabular-nums'] }}>{i.value}</T> : null}
      </View>
      {i.text ? <T style={{ marginTop: 12, fontSize: 14, lineHeight: 20, color: C.ink2 }}>{i.text}</T> : null}
      {i.care ? (
        <View style={{ marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: 'rgba(46,158,107,0.09)', flexDirection: 'row', gap: 8 }}>
          <IconCheck size={16} color={C.ok} width={2.4} />
          <View style={{ flex: 1 }}>
            <T w="semibold" style={{ fontSize: 13, color: '#125742' }}>Ošetření</T>
            <T style={{ fontSize: 13, lineHeight: 18, color: '#125742' }}>{i.care}</T>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function Action({ label, Icon, onPress }: { label: string; Icon: (p: { size?: number; color?: string; width?: number }) => React.ReactElement; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 72, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.75 : 1 })}>
      <Icon size={20} color={C.ink} width={1.9} />
      <T w="semibold" style={{ fontSize: 13 }}>{label}</T>
    </Pressable>
  );
}

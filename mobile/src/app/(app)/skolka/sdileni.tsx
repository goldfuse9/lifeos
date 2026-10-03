import React from 'react';
import { ScrollView, View } from 'react-native';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { pickupOptions, shareOf, type SkolkaShare } from '@/domain/skolka';
import { Backdrop, BottomFade, Card, Divider, H1, Loading, Muted, T, ToggleRow, TopBar, useScreenInsets } from '@/ui/kit';

/**
 * Co školka uvidí. Výchozí je jen to, co ke dni ve školce opravdu patří
 * (alergie, kontakty, kdo vyzvedává); očkování a anamnéza jsou vypnuté.
 * Ukládá se už teď — ke školce odejde, až bude propojení (fáze 2).
 */
export default function SkolkaSdileni() {
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const { value, reload } = useLoad(async () => {
    const [sk, em] = await Promise.all([data.personData.get(person.id, 'skolka'), data.personData.get(person.id, 'emergency')]);
    return { sk, em };
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

  const share = shareOf(value.sk);
  const set = async (k: keyof SkolkaShare, v: boolean) => {
    await data.personData.set(person.id, 'skolka', { ...value.sk, share: { ...share, [k]: v } });
    touch();
    reload();
  };
  const people = pickupOptions(value.sk);
  const rows: [keyof SkolkaShare, string, string][] = [
    ['alergie', 'Alergie', value.em.allergies || 'z nouzové karty'],
    ['kontakty', 'Kontakty na rodiče', 'telefon a e-mail'],
    ['poverene', 'Kdo smí vyzvedávat', people.length ? people.join(', ') : 'jen rodiče'],
    ['ockovani', 'Očkování', 'povinná očkování pro přijetí'],
    ['anamneza', 'Anamnéza', 'nemoci, operace, léky'],
  ];

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>Co školka uvidí</H1>
        <Muted style={{ marginTop: 4, paddingLeft: 8 }}>{value.sk.name || 'Školka'}</Muted>

        <Card style={{ marginTop: 16, borderRadius: 22, overflow: 'hidden' }}>
          {rows.map(([k, title, sub], i) => (
            <View key={k}>
              {i ? <Divider /> : null}
              <ToggleRow title={title} sub={sub} value={share[k]} onChange={(v) => set(k, v)} />
            </View>
          ))}
        </Card>

        <View style={{ marginTop: 12, padding: 14, borderRadius: 20, backgroundColor: 'rgba(59,111,224,0.07)', borderWidth: 1, borderColor: 'rgba(59,111,224,0.16)' }}>
          <T style={{ fontSize: 13, lineHeight: 18, color: '#27407A' }}>Lékařské zprávy a zbytek karty zůstávají jen u vás. Školka tyhle údaje uvidí, až bude propojená s aplikací — nastavení se použije samo.</T>
        </View>
      </ScrollView>
      <BottomFade />
    </View>
  );
}

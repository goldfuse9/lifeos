import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad, useNow } from '@/state/useLoad';
import { vaccineOverview, type VaccineStatus } from '@/domain/vaccines';
import { numericDate, toLocalDate, toLocalTime } from '@/domain/dates';
import { Backdrop, BottomFade, Card, Divider, H1, Loading, Muted, Note, Row, T, TopBar, useScreenInsets, useToast } from '@/ui/kit';
import { ActionFab } from '@/ui/fabs';
import { chooseSource, pickFrom } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconCamera, TypeGlyph } from '@/ui/icons';

/**
 * Očkování — co a kdy, a kdy přeočkovat. Skládá se ze záznamů typu
 * Očkování v ose; fotky průkazu jsou jeden záznam „Očkovací průkaz“.
 */
export default function Ockovani() {
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const today = toLocalDate(useNow());
  const [busy, setBusy] = useState(false);

  const { value } = useLoad(async () => {
    const [recs, docs] = await Promise.all([data.records.query({ personId: person.id, types: ['vaccine'] }), data.personData.get(person.id, 'docs')]);
    const card = docs.vaxRecordId ? await data.records.get(docs.vaxRecordId) : null;
    const photos = card ? await data.attachments.forRecord(card.id) : [];
    return { recs, docs, card, photos };
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

  const list = vaccineOverview(value.recs, today);
  const due = list.filter((v) => v.state === 'due' || v.state === 'soon');

  const photoCard = async () => {
    const src = await chooseSource('Očkovací průkaz');
    if (!src) return;
    const picked = await pickFrom(src);
    if (!picked.length) return;
    setBusy(true);
    try {
      let id = value.card?.id ?? null;
      if (!id) {
        const now = new Date();
        const rec = await data.records.create(person.id, { type: 'doc', title: 'Očkovací průkaz', description: '', date: toLocalDate(now), time: toLocalTime(now) });
        id = rec.id;
        await data.personData.set(person.id, 'docs', { ...value.docs, vaxRecordId: id });
      }
      for (const [i, p] of picked.entries()) {
        const ext = /\.[a-z0-9]{1,6}$/i.exec(p.name)?.[0] ?? '.jpg';
        await data.files.add(id, person.id, { ...p, name: `Očkovací průkaz ${value.photos.length + i + 1}${ext}` });
      }
      touch();
      toast('Uloženo · najdete i v Dokumentech');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fotku se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} backLabel="Zpět" />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Očkování</H1>
          <Muted style={{ marginTop: 4 }}>
            {!list.length ? 'Co a kdy, a kdy přeočkovat' : due.length ? due.map((v) => v.name).join(', ') + (due.some((v) => v.state === 'due') ? ' — po termínu přeočkování' : ' — blíží se přeočkování') : 'Nic nečeká na přeočkování'}
          </Muted>
        </View>

        {list.length ? (
          <Card style={{ marginTop: 16, overflow: 'hidden', borderRadius: 24 }}>
            {list.map((v, i) => (
              <View key={v.name}>
                {i ? <Divider /> : null}
                <Row title={v.name} sub={'naposledy ' + numericDate(v.lastDate) + (v.nextDue ? ' · přeočkovat ' + numericDate(v.nextDue) : '')} right={<Badge v={v} />} onPress={() => router.push(`/zaznam/${v.last.id}`)} />
              </View>
            ))}
          </Card>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => router.push('/ockovani/upravit')} style={{ marginTop: 16, paddingVertical: 28, paddingHorizontal: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DCDAD6', borderRadius: 24, alignItems: 'center', gap: 8 }}>
            <TypeGlyph type="vaccine" color="#2E9E6B" size={22} />
            <Muted style={{ textAlign: 'center' }}>Zatím nic. Opište očkování z průkazu — stačí název a datum.</Muted>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={value.photos.length ? () => router.push(`/zaznam/${value.card!.id}`) : photoCard}
          style={({ pressed }) => ({ marginTop: 12, minHeight: 64, padding: 14, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#E0F5EC', alignItems: 'center', justifyContent: 'center' }}>
            <IconCamera size={18} color="#17694F" />
          </View>
          <View style={{ flex: 1 }}>
            <T w="semibold" style={{ fontSize: 15 }}>Očkovací průkaz</T>
            <T style={{ fontSize: 13, color: C.muted }}>{busy ? 'Ukládám…' : value.photos.length ? `${value.photos.length} ${value.photos.length === 1 ? 'fotka' : value.photos.length < 5 ? 'fotky' : 'fotek'} · otevřít` : 'Vyfotit stránky průkazu'}</T>
          </View>
        </Pressable>
        {value.photos.length ? (
          <Pressable accessibilityRole="button" onPress={photoCard} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 8, marginLeft: 4 }}>
            <T style={{ fontSize: 13, color: C.muted, textDecorationLine: 'underline' }}>Přidat další stránku</T>
          </Pressable>
        ) : null}

        <Note style={{ marginTop: 16 }}>Přeočkování je předvyplněné podle běžného schématu — vždy ho můžete změnit, rozhoduje lékař. Připomínka přijde měsíc předem, když máte zapnutá upozornění.</Note>
      </ScrollView>
      <BottomFade />
      <ActionFab label="Zapsat očkování" onPress={() => router.push('/ockovani/upravit')} />
    </View>
  );
}

function Badge({ v }: { v: VaccineStatus }) {
  if (v.state === 'none' || v.state === 'ok') return null;
  const due = v.state === 'due';
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 11, backgroundColor: due ? '#FDE7E5' : C.orangeTint }}>
      <T w="semibold" style={{ fontSize: 12, color: due ? '#B42318' : C.orangeInk }}>{due ? 'Po termínu' : 'Brzy'}</T>
    </View>
  );
}

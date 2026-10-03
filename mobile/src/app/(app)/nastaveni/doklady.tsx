import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { INSURERS, insurerName } from '@/domain/insurers';
import { toLocalDate, toLocalTime } from '@/domain/dates';
import type { Attachment, DocsData, PersonalData } from '@/domain/types';
import { Card, Chip, Field, Backdrop, Loading, Note, Row, T, TopBar, useToast } from '@/ui/kit';
import { chooseSource, pickFrom } from '@/ui/device';
import { C } from '@/ui/theme';

/**
 * Doklady — podle desky: kartička průkazu pojištěnce, pojišťovna,
 * fotky líce a rubu. Fotky jsou přílohy záznamu „Průkaz pojištěnce“,
 * takže je najdete i v Dokumentech pod „Doklady“.
 */

type Side = 'front' | 'back';

export default function Doklady() {
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState<Side | null>(null);

  const { value, reload } = useLoad(async () => {
    const [personal, docs] = await Promise.all([data.personData.get(person.id, 'personal'), data.personData.get(person.id, 'docs')]);
    const [front, back] = await Promise.all([docs.frontId ? data.attachments.get(docs.frontId) : null, docs.backId ? data.attachments.get(docs.backId) : null]);
    return { personal, docs, front, back };
  }, [person.id]);

  if (!value) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <Loading />
      </View>
    );
  }
  const { personal, docs, front, back } = value;

  const savePersonal = async (patch: Partial<PersonalData>) => {
    await data.personData.set(person.id, 'personal', { ...personal, ...patch });
    touch();
    reload();
  };
  const saveDocs = async (patch: Partial<DocsData>) => {
    await data.personData.set(person.id, 'docs', { ...docs, ...patch });
    touch();
    reload();
  };

  const upload = async (side: Side) => {
    const src = await chooseSource(side === 'front' ? 'Líc kartičky pojištěnce' : 'Rub kartičky pojištěnce');
    if (!src) return;
    const picked = await pickFrom(src);
    if (!picked.length) return;
    setBusy(side);
    try {
      // Jeden záznam „Průkaz pojištěnce“ pro obě strany.
      let recordId = docs.cardRecordId && (await data.records.get(docs.cardRecordId)) ? docs.cardRecordId : null;
      if (!recordId) {
        const now = new Date();
        const rec = await data.records.create(person.id, { type: 'doc', title: 'Průkaz pojištěnce', description: '', date: toLocalDate(now), time: toLocalTime(now) });
        recordId = rec.id;
      }
      const p = picked[0];
      const ext = /\.[a-z0-9]{1,6}$/i.exec(p.name)?.[0] ?? '.jpg';
      const a = await data.files.add(recordId, person.id, { ...p, name: (side === 'front' ? 'Průkaz pojištěnce – líc' : 'Průkaz pojištěnce – rub') + ext });
      const old = side === 'front' ? front : back;
      if (old) await data.files.remove(old.id);
      await saveDocs({ cardRecordId: recordId, [side === 'front' ? 'frontId' : 'backId']: a.id });
      toast(side === 'front' ? 'Líc kartičky uložen' : 'Rub kartičky uložen');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fotku se nepodařilo uložit.');
    } finally {
      setBusy(null);
    }
  };

  const name = [personal.firstName, personal.lastName].filter(Boolean).join(' ') || person.name;
  const ins = insurerName(personal.insurer);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title="Doklady" backLabel="Zpět do nastavení" />

        <T w="semibold" style={{ marginTop: 22, paddingLeft: 4, fontSize: 12, color: C.muted }}>Průkaz pojištěnce</T>
        <LinearGradient
          colors={['#2E2D33', '#4A4751', '#514F57']}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ marginTop: 8, height: 186, paddingVertical: 18, paddingHorizontal: 20, borderRadius: 22, overflow: 'hidden', boxShadow: '0px 14px 32px rgba(23,22,26,0.22)' }}
        >
          <View style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(215,242,58,0.18)' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>Průkaz pojištěnce</T>
            <T w="semibold" style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>{personal.insurer ?? ''}</T>
          </View>
          <T w="semibold" numberOfLines={1} style={{ marginTop: 26, fontSize: 19, lineHeight: 24, color: C.white }}>{name}</T>
          <T style={{ marginTop: 2, fontSize: 15, lineHeight: 20, letterSpacing: 0.9, fontVariant: ['tabular-nums'], color: 'rgba(255,255,255,0.92)' }}>{personal.insuranceNo || 'číslo pojištěnce nevyplněno'}</T>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            <T style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{ins ?? 'pojišťovna nevybrána'}</T>
            {docs.validUntil ? <T style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>platí do {docs.validUntil}</T> : null}
          </View>
        </LinearGradient>

        <Card style={{ marginTop: 12, padding: 16, gap: 14 }}>
          <View style={{ gap: 6 }}>
            <T w="semibold" style={{ fontSize: 13, color: C.muted }}>Zdravotní pojišťovna</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {INSURERS.map(([code, n]) => (
                <Chip key={code} label={code + ' · ' + n} selected={personal.insurer === code} onPress={() => savePersonal({ insurer: personal.insurer === code ? '' : code })} />
              ))}
            </View>
          </View>
          <ValidField value={docs.validUntil ?? ''} onSave={(v) => saveDocs({ validUntil: v })} />
        </Card>

        <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
          <SideTile label="Líc" a={front} uri={front ? data.files.uri(front) : null} busy={busy === 'front'} onUpload={() => upload('front')} />
          <SideTile label="Rub" a={back} uri={back ? data.files.uri(back) : null} busy={busy === 'back'} onUpload={() => upload('back')} />
        </View>
        <T style={{ marginTop: 8, paddingHorizontal: 4, fontSize: 12, lineHeight: 16, color: C.muted }}>Fotky najdete i v Dokumentech pod „Doklady“. Klepnutím fotku otevřete, podržením vyměníte.</T>

        <T w="semibold" style={{ marginTop: 22, paddingLeft: 4, fontSize: 12, color: C.muted }}>Ověření a zastupování</T>
        <Card style={{ marginTop: 8, overflow: 'hidden', borderRadius: 20 }}>
          <Row title="Občanský průkaz a rodné listy" sub="Ověření identity a zastupování dětí" disabledNote="Připravujeme" onPress={() => toast('Ověření dokladů přijde s online verzí.')} />
        </Card>
        <Note style={{ marginTop: 14 }}>Fotky dokladů jsou jen v tomto telefonu, v soukromé složce aplikace.</Note>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ValidField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const fmt = (s: string) => {
    const d = s.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
  };
  return <Field label="Platí do" value={v} placeholder="MM/RR" keyboardType="number-pad" maxLength={5} onChangeText={(s) => setV(fmt(s))} onBlur={() => v !== value && onSave(v)} />;
}

function SideTile({ label, a, uri, busy, onUpload }: { label: string; a: Attachment | null; uri: string | null; busy: boolean; onUpload: () => void }) {
  const ok = !!a;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ok ? label + ' kartičky — otevřít' : label + ' kartičky — vyfotit'}
      disabled={busy}
      onPress={() => (a ? router.push(`/priloha/${a.id}`) : onUpload())}
      onLongPress={ok ? onUpload : undefined}
      style={({ pressed }) => ({ flex: 1, height: 96, borderRadius: 18, borderWidth: 1.5, borderStyle: ok ? 'solid' : 'dashed', borderColor: ok ? '#9FD3B5' : '#F7B56A', backgroundColor: ok ? '#EAF6EE' : '#FFF4E6', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pressed ? 0.8 : 1 })}
    >
      {ok && uri && a!.kind === 'photo' ? <Image source={{ uri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }} resizeMode="cover" /> : null}
      <T w="semibold" style={{ fontSize: 14, color: ok ? '#17694F' : '#7A4300' }}>{label}</T>
      <T style={{ fontSize: 12, color: ok ? '#17694F' : '#7A4300' }}>{busy ? 'Ukládám…' : ok ? 'Nahráno ✓' : 'Vyfotit'}</T>
    </Pressable>
  );
}

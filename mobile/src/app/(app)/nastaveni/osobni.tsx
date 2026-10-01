import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import type { LocalDate, PersonalData } from '@/domain/types';
import { toLocalDate } from '@/domain/dates';
import { Backdrop, Card, Field, PrimaryButton, Segmented, T, TopBar, useToast } from '@/ui/kit';
import { DateField } from '@/ui/DateTimeField';
import { confirm } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconCheck, IconWarn } from '@/ui/icons';

/**
 * Osobní údaje karty — podle desky „Osobní údaje“: nahoře údaje, které
 * chce lékař (stav místo červených rámečků), pak tělo s BMI, životospráva
 * a kontakt. Pojišťovna a kartička jsou v „Doklady“.
 */

const LIFE: { k: 'smoking' | 'alcohol' | 'activity'; label: string; opts: string[] }[] = [
  { k: 'smoking', label: 'Kouření', opts: ['Nekouřím', 'Příležitostně', 'Denně'] },
  { k: 'alcohol', label: 'Alkohol', opts: ['Nepiju', 'Příležitostně', 'Pravidelně'] },
  { k: 'activity', label: 'Pohyb', opts: ['Málo', 'Občas', 'Pravidelně'] },
];

const num = (s?: string) => parseFloat(String(s ?? '').replace(',', '.'));

function bmiOf(height?: string, weight?: string): { value: string; band: string } | null {
  const h = num(height) / 100;
  const w = num(weight);
  if (!(h > 0.5 && h < 2.6 && w > 2 && w < 400)) return null;
  const b = w / (h * h);
  // Pásmo se pojmenuje a tečka — bez barevného soudu.
  const band = b < 18.5 ? 'podváha' : b < 25 ? 'v pásmu normy' : b < 30 ? 'nadváha' : 'obezita';
  return { value: (Math.round(b * 10) / 10).toString().replace('.', ','), band };
}

export default function Osobni() {
  const data = useData();
  const person = usePerson();
  const { touch, reloadPersons } = useSession();
  const toast = useToast();
  const navigation = useNavigation();
  const [d, setD] = useState<PersonalData | null>(null);
  const [birth, setBirth] = useState<LocalDate | null>(person.birthDate);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    data.personData.get(person.id, 'personal').then(setD);
  }, [data, person.id]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!dirty.current) return;
      e.preventDefault();
      confirm('Zahodit změny?', 'Neuložené údaje se ztratí.', 'Zahodit').then((ok) => ok && navigation.dispatch(e.data.action));
    });
  }, [navigation]);

  if (!d) return <Backdrop />;

  const set = (k: keyof PersonalData) => (v: string) => {
    dirty.current = true;
    setD({ ...d, [k]: v });
  };

  const missing = [d.firstName, d.lastName, birth, d.rc, d.insuranceNo].filter((v) => !String(v ?? '').trim()).length;
  const bmi = bmiOf(d.height, d.weight);

  const save = async () => {
    setBusy(true);
    try {
      await data.personData.set(person.id, 'personal', d);
      if (birth !== person.birthDate) {
        await data.persons.update(person.id, { birthDate: birth });
        await reloadPersons();
      }
      dirty.current = false;
      touch();
      toast('Údaje uloženy');
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title="Osobní údaje" backLabel="Zpět do nastavení" />

        <Section title="Údaje pro lékaře" note="bez nich vás lékař nezapíše" />
        <View accessibilityRole="text" style={{ marginTop: 8, padding: 12, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: missing ? 'rgba(247,147,30,0.09)' : 'rgba(46,158,107,0.09)', borderWidth: 1, borderColor: missing ? 'rgba(247,147,30,0.24)' : 'rgba(46,158,107,0.22)' }}>
          {missing ? <IconWarn size={16} color={C.orangeInk} /> : <IconCheck size={16} color="#125742" />}
          <T w="semibold" style={{ fontSize: 13, color: missing ? C.orangeInk : '#125742' }}>
            {missing === 0 ? 'Vše vyplněno' : missing === 1 ? 'Chybí 1 údaj' : `Chybí ${missing} údaje`}
          </T>
        </View>

        <Card style={{ marginTop: 10, padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field style={{ flex: 1 }} label="Jméno" value={d.firstName ?? ''} onChangeText={set('firstName')} textContentType="givenName" />
            <Field style={{ flex: 1 }} label="Příjmení" value={d.lastName ?? ''} onChangeText={set('lastName')} textContentType="familyName" />
          </View>
          {birth ? (
            <View style={{ gap: 4 }}>
              <DateField label="Datum narození" value={birth} onChange={(v) => { dirty.current = true; setBirth(v); }} />
              <Pressable accessibilityRole="button" onPress={() => { dirty.current = true; setBirth(null); }} hitSlop={8}>
                <T style={{ fontSize: 13, color: C.muted, textDecorationLine: 'underline' }}>Odebrat datum narození</T>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => { dirty.current = true; setBirth(toLocalDate(new Date(new Date().getFullYear() - 30, 0, 1))); }} style={{ minHeight: 48, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DCDAD6', justifyContent: 'center', paddingHorizontal: 14 }}>
              <T w="semibold" style={{ fontSize: 14, color: C.muted }}>+ Doplnit datum narození</T>
            </Pressable>
          )}
          <Field label="Rodné číslo" value={d.rc ?? ''} onChangeText={set('rc')} placeholder="rrmmdd/xxxx" keyboardType="numbers-and-punctuation" maxLength={11} />
          <View style={{ gap: 4 }}>
            <Field label="Číslo pojištěnce" value={d.insuranceNo ?? ''} onChangeText={set('insuranceNo')} placeholder="u většiny shodné s rodným číslem" keyboardType="numbers-and-punctuation" />
            {d.rc && !d.insuranceNo ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => set('insuranceNo')(d.rc!.replace('/', ''))}>
                <T style={{ fontSize: 13, color: C.muted, textDecorationLine: 'underline' }}>Stejné jako rodné číslo</T>
              </Pressable>
            ) : null}
          </View>
          <View style={{ gap: 6 }}>
            <T w="semibold" style={{ fontSize: 13, color: C.muted }}>Pohlaví</T>
            <Segmented label="Pohlaví" options={[['žena', 'Žena'], ['muž', 'Muž'], ['jiné', 'Jiné']]} value={(d.sex ?? '') as 'žena'} onChange={(v) => set('sex')(v)} />
          </View>
        </Card>

        <Section title="Tělo" note="nepovinné" />
        <Card style={{ marginTop: 8, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field style={{ flex: 1 }} label="Výška (cm)" value={d.height ?? ''} onChangeText={set('height')} keyboardType="decimal-pad" placeholder="168" />
            <Field style={{ flex: 1 }} label="Váha (kg)" value={d.weight ?? ''} onChangeText={set('weight')} keyboardType="decimal-pad" placeholder="62" />
          </View>
          <View style={{ padding: 12, borderRadius: 18, backgroundColor: 'rgba(23,22,26,0.04)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T w="semibold" style={{ fontSize: 22, lineHeight: 26, letterSpacing: -0.4, fontVariant: ['tabular-nums'] }}>{bmi?.value ?? '—'}</T>
            <View style={{ flex: 1 }}>
              <T w="semibold" style={{ fontSize: 12, lineHeight: 16, color: C.muted, letterSpacing: 0.7 }}>BMI</T>
              <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{bmi ? bmi.band : 'doplňte výšku a váhu'}</T>
            </View>
          </View>
          <T style={{ fontSize: 12, lineHeight: 16, color: C.muted }}>BMI je hrubý ukazatel — neříká nic o složení těla ani o zdraví jednotlivce.</T>
        </Card>

        <Section title="Životospráva" note="nepovinné" />
        <Card style={{ marginTop: 8, padding: 16, gap: 14 }}>
          {LIFE.map((l) => (
            <View key={l.k} style={{ gap: 6 }}>
              <T w="semibold" style={{ fontSize: 13, color: C.muted }}>{l.label}</T>
              <Segmented label={l.label} options={l.opts.map((o) => [o, o] as [string, string])} value={d[l.k] ?? ''} onChange={(v) => set(l.k)(d[l.k] === v ? '' : v)} />
            </View>
          ))}
        </Card>

        <Section title="Kontakt" note="nepovinné" />
        <Card style={{ marginTop: 8, padding: 16, gap: 14 }}>
          <Field label="Telefon" value={d.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad" textContentType="telephoneNumber" placeholder="+420 …" />
          <Field label="E-mail" value={d.email ?? ''} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" />
          <Field label="Adresa" value={d.address ?? ''} onChangeText={set('address')} textContentType="fullStreetAddress" placeholder="Ulice, město, PSČ" />
        </Card>

        <PrimaryButton style={{ marginTop: 24 }} label="Uložit změny" onPress={save} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, note }: { title: string; note?: string }) {
  return (
    <View style={{ marginTop: 22, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <T w="semibold" style={{ fontSize: 11, lineHeight: 15, color: C.muted, letterSpacing: 0.9, textTransform: 'uppercase' }}>{title}</T>
      {note ? <T style={{ fontSize: 11, lineHeight: 15, color: C.muted }}>{note}</T> : null}
    </View>
  );
}

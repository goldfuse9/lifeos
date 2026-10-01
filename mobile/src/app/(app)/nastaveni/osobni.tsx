import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import type { LocalDate, PersonalData } from '@/domain/types';
import { toLocalDate } from '@/domain/dates';
import { Backdrop, Card, Chip, Field, H1, Muted, PrimaryButton, Segmented, T, TopBar, useToast } from '@/ui/kit';
import { DateField } from '@/ui/DateTimeField';
import { confirm } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconChevronDown } from '@/ui/icons';

/**
 * Osobní údaje karty. Nahoře jen základ; tělo a životospráva jsou
 * sbalené, aby formulář nepůsobil jako úřad. Nic není povinné.
 */

const INSURERS: [string, string][] = [['111', 'VZP'], ['201', 'VoZP'], ['205', 'ČPZP'], ['207', 'OZP'], ['209', 'ZPŠ'], ['211', 'ZP MV'], ['213', 'RBP']];
const LIFE: { k: 'smoking' | 'alcohol' | 'activity'; label: string; opts: string[] }[] = [
  { k: 'smoking', label: 'Kouření', opts: ['Nekouřím', 'Příležitostně', 'Denně'] },
  { k: 'alcohol', label: 'Alkohol', opts: ['Nepiju', 'Příležitostně', 'Pravidelně'] },
  { k: 'activity', label: 'Pohyb', opts: ['Málo', 'Občas', 'Pravidelně'] },
];

export default function Osobni() {
  const data = useData();
  const person = usePerson();
  const { touch, reloadPersons, self } = useSession();
  const toast = useToast();
  const navigation = useNavigation();
  const [d, setD] = useState<PersonalData | null>(null);
  const [birth, setBirth] = useState<LocalDate | null>(person.birthDate);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const isSelf = self?.id === person.id;

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
        <TopBar title={person.name} backLabel="Zpět do nastavení" />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>Osobní údaje</H1>
        <Muted style={{ paddingLeft: 8, marginTop: 4 }}>Nic není povinné. Vyplňte, co se hodí mít po ruce u lékaře.</Muted>

        <Card style={{ marginTop: 16, padding: 16, gap: 14 }}>
          {isSelf ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field style={{ flex: 1 }} label="Jméno" value={d.firstName ?? ''} onChangeText={set('firstName')} textContentType="givenName" />
              <Field style={{ flex: 1 }} label="Příjmení" value={d.lastName ?? ''} onChangeText={set('lastName')} textContentType="familyName" />
            </View>
          ) : null}
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
          <View style={{ gap: 6 }}>
            <T w="semibold" style={{ fontSize: 13, color: C.muted }}>Pohlaví</T>
            <Segmented label="Pohlaví" options={[['žena', 'Žena'], ['muž', 'Muž'], ['jiné', 'Jiné']]} value={(d.sex ?? '') as 'žena'} onChange={(v) => set('sex')(v)} />
          </View>
          <View style={{ gap: 6 }}>
            <T w="semibold" style={{ fontSize: 13, color: C.muted }}>Zdravotní pojišťovna</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {INSURERS.map(([code, name]) => (
                <Chip key={code} label={code + ' ' + name} selected={d.insurer === code} onPress={() => set('insurer')(d.insurer === code ? '' : code)} />
              ))}
            </View>
          </View>
          <Field label="Číslo pojištěnce" value={d.insuranceNo ?? ''} onChangeText={set('insuranceNo')} keyboardType="numbers-and-punctuation" hint="Je na kartičce pojištěnce." />
          {isSelf ? (
            <>
              <Field label="Telefon" value={d.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad" textContentType="telephoneNumber" />
              <Field label="Adresa" value={d.address ?? ''} onChangeText={set('address')} textContentType="fullStreetAddress" />
            </>
          ) : null}
        </Card>

        <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }} onPress={() => setMore((m) => !m)} style={{ marginTop: 16, minHeight: 48, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T w="semibold" style={{ fontSize: 15 }}>Tělo a životospráva</T>
          <View style={{ transform: [{ rotate: more ? '180deg' : '0deg' }] }}>
            <IconChevronDown size={18} color={C.muted} />
          </View>
        </Pressable>
        {more ? (
          <Card style={{ padding: 16, gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field style={{ flex: 1 }} label="Výška (cm)" value={d.height ?? ''} onChangeText={set('height')} keyboardType="decimal-pad" />
              <Field style={{ flex: 1 }} label="Váha (kg)" value={d.weight ?? ''} onChangeText={set('weight')} keyboardType="decimal-pad" />
            </View>
            {LIFE.map((l) => (
              <View key={l.k} style={{ gap: 6 }}>
                <T w="semibold" style={{ fontSize: 13, color: C.muted }}>{l.label}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {l.opts.map((o) => (
                    <Chip key={o} label={o} selected={d[l.k] === o} onPress={() => set(l.k)(d[l.k] === o ? '' : o)} />
                  ))}
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <PrimaryButton style={{ marginTop: 24 }} label="Uložit" onPress={save} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

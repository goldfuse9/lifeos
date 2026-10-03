import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { ZNACKY, type SkolkaData } from '@/domain/skolka';
import { Backdrop, Card, Field, H1, Loading, PrimaryButton, T, TopBar, haptic, useToast } from '@/ui/kit';
import { Znacka } from '@/ui/Znacka';
import { C } from '@/ui/theme';
import { IconClose } from '@/ui/icons';

/**
 * Nastavení školky — jen to, bez čeho to nejde: název, telefon (na SMS
 * a volání), značka ze šatny a kdo smí vyzvedávat. Třída je nepovinná.
 */
export default function SkolkaNastavit() {
  const data = useData();
  const person = usePerson();
  const { value } = useLoad(() => data.personData.get(person.id, 'skolka'), [person.id]);

  if (!value) {
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
  return <Form initial={value} />;
}

function Form({ initial }: { initial: SkolkaData }) {
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const [name, setName] = useState(initial.name ?? '');
  const [trida, setTrida] = useState(initial.trida ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [znacka, setZnacka] = useState(initial.znacka ?? '');
  const [people, setPeople] = useState<string[]>(initial.poverene ?? []);
  const [newPerson, setNewPerson] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const addPerson = () => {
    const v = newPerson.trim();
    if (!v || people.includes(v)) return;
    setPeople((p) => [...p, v]);
    setNewPerson('');
  };

  const save = async () => {
    setTried(true);
    if (!name.trim()) return;
    setBusy(true);
    try {
      const extra = newPerson.trim() && !people.includes(newPerson.trim()) ? [newPerson.trim()] : [];
      await data.personData.set(person.id, 'skolka', { ...initial, name, trida, phone, znacka: znacka || undefined, poverene: [...people, ...extra] });
      touch();
      toast('Školka uložena');
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 20 : 48, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} backLabel="Zavřít" />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>Školka</H1>

        <Card style={{ marginTop: 16, padding: 16, gap: 14 }}>
          <Field label="Název školky" value={name} onChangeText={setName} placeholder="Např. MŠ Sluníčko" maxLength={80} error={tried && !name.trim() ? 'Vyplňte název.' : null} />
          <Field label="Třída" value={trida} onChangeText={setTrida} placeholder="Nepovinné, např. Berušky" maxLength={40} />
          <Field label="Telefon do školky" value={phone} onChangeText={setPhone} placeholder="Na omluvenky a volání" keyboardType="phone-pad" maxLength={20} />
        </Card>

        <T w="semibold" style={{ marginTop: 20, paddingLeft: 4, fontSize: 13, color: C.muted }}>Značka ze šatny</T>
        <View accessibilityRole="radiogroup" style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ZNACKY.map((z) => {
            const on = z.key === znacka;
            return (
              <Pressable
                key={z.key}
                accessibilityRole="radio"
                accessibilityLabel={z.name}
                accessibilityState={{ checked: on }}
                onPress={() => {
                  haptic();
                  setZnacka(on ? '' : z.key);
                }}
                style={({ pressed }) => ({ width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 2, borderColor: on ? C.ink : 'transparent', opacity: pressed ? 0.8 : 1 })}
              >
                <Znacka value={z.key} size={40} />
              </Pressable>
            );
          })}
        </View>

        <T w="semibold" style={{ marginTop: 20, paddingLeft: 4, fontSize: 13, color: C.muted }}>Kdo smí vyzvedávat (kromě rodičů)</T>
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {people.map((p) => (
            <Pressable key={p} accessibilityRole="button" accessibilityLabel={'Odebrat ' + p} onPress={() => setPeople((cur) => cur.filter((x) => x !== p))} style={{ minHeight: 40, paddingLeft: 14, paddingRight: 10, borderRadius: 20, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T w="semibold" style={{ fontSize: 14, color: C.white }}>{p}</T>
              <IconClose size={14} color={C.white} />
            </Pressable>
          ))}
        </View>
        <Card style={{ marginTop: 8, padding: 16 }}>
          <Field label="Přidat osobu" value={newPerson} onChangeText={setNewPerson} placeholder="Např. babička Věra" maxLength={40} returnKeyType="done" onSubmitEditing={addPerson} />
          {newPerson.trim() ? (
            <Pressable accessibilityRole="button" onPress={addPerson} style={{ marginTop: 10, alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.chip, borderWidth: 1, borderColor: C.line, justifyContent: 'center' }}>
              <T w="semibold" style={{ fontSize: 14 }}>+ Přidat</T>
            </Pressable>
          ) : null}
        </Card>

        <PrimaryButton style={{ marginTop: 24 }} label="Uložit" onPress={save} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

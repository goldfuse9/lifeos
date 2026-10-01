import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData, useSession } from '@/state/session';
import type { LocalDate, Relation } from '@/domain/types';
import { toLocalDate } from '@/domain/dates';
import { Avatar, Backdrop, Card, Field, H1, Muted, PrimaryButton, SecondaryButton, Segmented, T, TopBar, useToast } from '@/ui/kit';
import { DateField } from '@/ui/DateTimeField';
import { confirm } from '@/ui/device';
import { AVATARS, C } from '@/ui/theme';
import { IconTrash } from '@/ui/icons';

/**
 * Karta člena rodiny — nová nebo úprava. Karty jsou jen v tomto telefonu;
 * sdílení s druhým rodičem a vztahy patří do fáze 2.
 */
export default function KartaEdit() {
  const params = useLocalSearchParams<{ id?: string; new?: string }>();
  const data = useData();
  const s = useSession();
  const toast = useToast();
  const existing = params.id ? s.persons.find((p) => p.id === params.id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [relation, setRelation] = useState<Relation>(existing?.relation ?? 'child');
  const [birth, setBirth] = useState<LocalDate | null>(existing?.birthDate ?? null);
  const [color, setColor] = useState(existing?.color ?? (s.persons.length % AVATARS.length));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setTried(true);
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (existing) {
        await data.persons.update(existing.id, { name, relation, birthDate: birth, color });
        await s.reloadPersons();
        toast('Karta upravena');
      } else {
        const p = await data.persons.create({ name, relation, birthDate: birth, color });
        await s.reloadPersons();
        await s.setPerson(p.id);
        toast('Karta vytvořena: ' + p.name);
      }
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm(`Odebrat kartu ${existing.name}?`, 'Smažou se i všechny její záznamy a soubory v tomto telefonu.', 'Odebrat');
    if (!ok) return;
    await data.persons.softDelete(existing.id);
    await data.files.collectGarbage();
    if (s.self) await s.setPerson(s.self.id);
    await s.reloadPersons();
    toast('Karta odebrána');
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>{existing ? 'Upravit kartu' : 'Nová karta'}</H1>
        <Muted style={{ paddingLeft: 8, marginTop: 4 }}>Pro dítě, partnera nebo rodiče, o které se staráte.</Muted>

        <Card style={{ marginTop: 16, padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
            {AVATARS.map((_, i) => (
              <Pressable key={i} accessibilityRole="button" accessibilityLabel={'Barva ' + (i + 1)} accessibilityState={{ selected: color === i }} onPress={() => setColor(i)} style={{ padding: 2, borderRadius: 18, borderWidth: 2, borderColor: color === i ? C.ink : 'transparent' }}>
                <Avatar name={name || '?'} color={i} size={40} />
              </Pressable>
            ))}
          </View>
          <Field label="Jméno" value={name} onChangeText={setName} autoFocus={!existing} placeholder="Např. Ema" error={tried && !name.trim() ? 'Vyplňte jméno.' : null} maxLength={60} />
          <View style={{ gap: 6 }}>
            <T w="semibold" style={{ fontSize: 13, color: C.muted }}>Kdo to je</T>
            <Segmented label="Vztah" options={[['child', 'Dítě'], ['partner', 'Partner/ka'], ['parent', 'Rodič'], ['other', 'Jiný']]} value={relation} onChange={setRelation} />
          </View>
          {birth ? (
            <DateField label="Datum narození" value={birth} onChange={setBirth} />
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setBirth(toLocalDate(new Date(new Date().getFullYear() - (relation === 'child' ? 5 : 35), 0, 1)))} style={{ minHeight: 48, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DCDAD6', justifyContent: 'center', paddingHorizontal: 14 }}>
              <T w="semibold" style={{ fontSize: 14, color: C.muted }}>+ Doplnit datum narození</T>
            </Pressable>
          )}
        </Card>

        <PrimaryButton style={{ marginTop: 24 }} label={existing ? 'Uložit' : 'Vytvořit kartu'} onPress={save} busy={busy} />
        {existing && !existing.isSelf ? (
          <SecondaryButton style={{ marginTop: 10 }} danger label="Odebrat kartu" onPress={remove} icon={<IconTrash size={16} color={C.danger} width={1.8} />} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import type { Doctor, DoctorRole } from '@/domain/types';
import { newId } from '@/platform/secure';
import { Backdrop, Card, Divider, Field, H1, Muted, Note, PrimaryButton, SecondaryButton, Segmented, T, TopBar, useScreenInsets, useToast } from '@/ui/kit';
import { confirm } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconPhone, IconTrash } from '@/ui/icons';

/**
 * Moji lékaři. Na plátně se lékař vyhledával v registru — registr je
 * online služba (fáze 2). Tady se lékař zadává ručně a jde mu rovnou
 * zavolat.
 */

const ROLES: [DoctorRole, string][] = [
  ['praktik', 'Praktický'],
  ['pediatr', 'Pediatr'],
  ['zubar', 'Zubař'],
  ['gyn', 'Gynekolog'],
  ['spec', 'Specialista'],
];
const ROLE_LONG: Record<DoctorRole, string> = { praktik: 'Praktický lékař', pediatr: 'Pediatr', zubar: 'Zubní lékař', gyn: 'Gynekolog', spec: 'Specialista' };

export default function Lekari() {
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const ins = useScreenInsets();
  const { value } = useLoad(() => data.personData.get(person.id, 'doctors'), [person.id]);
  const list = value?.list ?? [];
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [tried, setTried] = useState(false);

  const save = async (d: Doctor) => {
    setTried(true);
    if (!d.name.trim()) return;
    const next = list.some((x) => x.id === d.id) ? list.map((x) => (x.id === d.id ? d : x)) : [...list, d];
    await data.personData.set(person.id, 'doctors', { list: next.map((x) => ({ ...x, name: x.name.trim(), phone: x.phone?.trim(), place: x.place?.trim(), specialty: x.specialty?.trim() })) });
    setEditing(null);
    setTried(false);
    touch();
    toast('Uloženo: ' + d.name.trim());
  };

  const remove = async (d: Doctor) => {
    if (!(await confirm('Odebrat lékaře?', d.name, 'Odebrat'))) return;
    await data.personData.set(person.id, 'doctors', { list: list.filter((x) => x.id !== d.id) });
    setEditing(null);
    touch();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Moji lékaři</H1>
          <Muted style={{ marginTop: 4 }}>{list.length ? 'Klepnutím upravíte, telefonem rovnou zavoláte.' : 'Zatím žádný. Přidejte praktika, pediatra nebo zubaře.'}</Muted>
        </View>

        {list.length ? (
          <Card style={{ marginTop: 16, overflow: 'hidden' }}>
            {list.map((d, i) => (
              <View key={d.id}>
                {i ? <Divider /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 8, minHeight: 68, gap: 10 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={'Upravit ' + d.name} onPress={() => setEditing(d)} style={{ flex: 1, paddingVertical: 10 }}>
                    <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{d.name}</T>
                    <T numberOfLines={2} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{[ROLE_LONG[d.role], d.specialty, d.place].filter(Boolean).join(' · ')}</T>
                  </Pressable>
                  {d.phone ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={'Zavolat ' + d.name} onPress={() => Linking.openURL('tel:' + d.phone!.replace(/\s+/g, ''))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0F5EC', alignItems: 'center', justifyContent: 'center' }}>
                      <IconPhone size={18} color={C.ok} width={1.8} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {editing ? (
          <Card style={{ marginTop: 16, padding: 16, gap: 14 }}>
            <T w="semibold" style={{ fontSize: 16 }}>{list.some((x) => x.id === editing.id) ? 'Upravit lékaře' : 'Nový lékař'}</T>
            <Field label="Jméno" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} placeholder="MUDr. Jana Nováková" autoFocus error={tried && !editing.name.trim() ? 'Vyplňte jméno.' : null} />
            <View style={{ gap: 6 }}>
              <T w="semibold" style={{ fontSize: 13, color: C.muted }}>Role</T>
              <Segmented label="Role lékaře" options={ROLES} value={editing.role} onChange={(r) => setEditing({ ...editing, role: r })} />
            </View>
            {editing.role === 'spec' ? <Field label="Obor" value={editing.specialty ?? ''} onChangeText={(v) => setEditing({ ...editing, specialty: v })} placeholder="Např. ORL, alergologie" /> : null}
            <Field label="Telefon" value={editing.phone ?? ''} onChangeText={(v) => setEditing({ ...editing, phone: v })} keyboardType="phone-pad" placeholder="Nepovinné" textContentType="telephoneNumber" />
            <Field label="Ordinace" value={editing.place ?? ''} onChangeText={(v) => setEditing({ ...editing, place: v })} placeholder="Nepovinné" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SecondaryButton label="Zrušit" style={{ flex: 1 }} onPress={() => { setEditing(null); setTried(false); }} />
              <PrimaryButton label="Uložit" style={{ flex: 2 }} onPress={() => save(editing)} />
            </View>
            {list.some((x) => x.id === editing.id) ? (
              <SecondaryButton label="Odebrat" danger icon={<IconTrash size={16} color={C.danger} width={1.8} />} onPress={() => remove(editing)} />
            ) : null}
          </Card>
        ) : (
          <PrimaryButton style={{ marginTop: 16 }} label="Přidat lékaře" onPress={() => setEditing({ id: newId(), name: '', role: 'praktik' })} />
        )}

        <Note style={{ marginTop: 20 }}>Vyhledávání v registru lékařů a sdílení karty s lékařem přijde s online verzí.</Note>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

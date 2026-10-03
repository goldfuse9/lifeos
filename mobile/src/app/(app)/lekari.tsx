import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import type { Doctor, DoctorRole } from '@/domain/types';
import { newId } from '@/platform/secure';
import { registryAvailable, suggestDoctors } from '@/data/doctorRegistry';
import type { DoctorSuggestion } from '@/domain/doctorRegistry';
import { Backdrop, Card, Divider, Field, H1, Muted, Note, PrimaryButton, SecondaryButton, Segmented, T, TopBar, useScreenInsets, useToast } from '@/ui/kit';
import { confirm } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconPhone, IconTrash } from '@/ui/icons';

/**
 * Moji lékaři. Při psaní jména aplikace našeptává lékaře z Národního
 * registru poskytovatelů zdravotních služeb (otevřená data, přibalená
 * v aplikaci — funguje offline). Kdo v registru není, zadá se ručně.
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
  const [picked, setPicked] = useState(false);
  const hasRegistry = useMemo(() => registryAvailable(), []);
  const suggestions = useMemo(
    () => (editing && hasRegistry && !picked && editing.name.trim().length >= 2 ? suggestDoctors(editing.name) : []),
    [editing, hasRegistry, picked],
  );

  const pick = (s: DoctorSuggestion) => {
    if (!editing) return;
    setPicked(true);
    setEditing({ ...editing, name: s.name, role: s.role, specialty: s.specialty || undefined, phone: s.phone || editing.phone, place: s.place || editing.place });
  };

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
                  <Pressable accessibilityRole="button" accessibilityLabel={'Upravit ' + d.name} onPress={() => { setPicked(true); setEditing(d); }} style={{ flex: 1, paddingVertical: 10 }}>
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
            <Field
              label="Jméno"
              value={editing.name}
              onChangeText={(v) => {
                setPicked(false);
                setEditing({ ...editing, name: v });
              }}
              placeholder={hasRegistry ? 'Začněte psát příjmení nebo obor a město' : 'MUDr. Jana Nováková'}
              autoCorrect={false}
              error={tried && !editing.name.trim() ? 'Vyplňte jméno.' : null}
            />
            {suggestions.length ? (
              <View accessibilityRole="list" style={{ marginTop: -6, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, overflow: 'hidden' }}>
                {suggestions.map((s, i) => (
                  <Pressable key={s.name + s.place + i} accessibilityRole="button" onPress={() => pick(s)} style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, backgroundColor: pressed ? '#F4F4F3' : 'transparent' })}>
                    <T w="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{s.name}</T>
                    <T numberOfLines={2} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{[ROLE_LONG[s.role] === 'Specialista' ? s.specialty : ROLE_LONG[s.role], s.place].filter(Boolean).join(' · ')}</T>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {hasRegistry && !picked && editing.name.trim().length >= 3 && !suggestions.length ? (
              <T style={{ marginTop: -6, fontSize: 13, color: C.muted }}>V registru nenalezeno — doplňte údaje ručně.</T>
            ) : null}
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
          <PrimaryButton style={{ marginTop: 16 }} label="Přidat lékaře" onPress={() => { setPicked(false); setEditing({ id: newId(), name: '', role: 'praktik' }); }} />
        )}

        <Note style={{ marginTop: 20 }}>
          {hasRegistry
            ? 'Návrhy pocházejí z Národního registru poskytovatelů zdravotních služeb (ÚZIS). Sdílení karty s lékařem přijde s online verzí.'
            : 'Registr lékařů zatím není v aplikaci nahraný — lékaře zadejte ručně. Sdílení karty s lékařem přijde s online verzí.'}
        </Note>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

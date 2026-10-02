import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { DUE_OPTIONS, addYears, vaccineOf, vaccineRecord } from '@/domain/vaccines';
import { VAX_CATALOG, matchVaccine } from '@/domain/vaccineCatalog';
import { diffDays, numericDate, toLocalDate } from '@/domain/dates';
import type { HcRecord } from '@/domain/types';
import { Backdrop, Card, Chip, Field, H1, Loading, PrimaryButton, SecondaryButton, T, TopBar, useToast } from '@/ui/kit';
import { DateField } from '@/ui/DateTimeField';
import { confirm } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconTrash } from '@/ui/icons';

const suggestedYears = (n: string) => (n.trim() ? matchVaccine(n)?.boosterYears ?? null : null);

/** Zapsat očkování — co, kdy, kdy přeočkovat. */
export default function OckovaniUpravit() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const data = useData();
  const { value, loading } = useLoad(async () => (params.id ? data.records.get(params.id) : null), [params.id]);
  if (params.id && loading && !value) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <Loading />
      </View>
    );
  }
  return <Form key={value?.id ?? 'new'} rec={value ?? null} name0={params.name ?? ''} />;
}

function Form({ rec, name0 }: { rec: HcRecord | null; name0: string }) {
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const today = toLocalDate(new Date());
  const v0 = rec ? vaccineOf(rec) : null;

  const [name, setName] = useState(v0?.name ?? name0);
  const [date, setDate] = useState(rec?.date ?? today);
  const years0 = v0?.nextDue && rec ? Math.round(diffDays(rec.date, v0.nextDue) / 365) : v0 ? null : suggestedYears(name0);
  const [years, setYears] = useState<number | null>(years0);
  const [touchedYears, setTouchedYears] = useState(!!rec);
  const [note, setNote] = useState(rec?.description ?? '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = (n: string) => {
    setName(n);
    if (!touchedYears) setYears(suggestedYears(n));
  };
  const nextDue = years ? addYears(date, years) : null;
  const preset = VAX_CATALOG.some((v) => v.name === name);

  const save = async () => {
    setTried(true);
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = vaccineRecord({ name: name.trim(), nextDue });
      const draft = { type: 'vaccine' as const, title: r.title, description: note.trim(), date, time: null, metadata: r.metadata };
      if (rec) await data.records.update(rec.id, draft);
      else await data.records.create(person.id, draft);
      touch();
      toast(rec ? 'Uloženo' : 'Očkování zapsáno do osy');
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!rec || !(await confirm('Smazat očkování?', 'Zmizí z osy i z přehledu očkování.', 'Smazat'))) return;
    await data.records.softDelete(rec.id);
    touch();
    toast('Smazáno');
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 20 : 48, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} backLabel="Zavřít" />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>{rec ? 'Upravit očkování' : 'Očkování'}</H1>

        {(['povinne', 'doporucene'] as const).map((g) => (
          <View key={g}>
            <T w="semibold" style={{ marginTop: 20, paddingLeft: 4, fontSize: 13, color: C.muted }}>{g === 'povinne' ? 'Povinná' : 'Nepovinná'}</T>
            <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {VAX_CATALOG.filter((v) => v.group === g).map((v) => (
                <Chip key={v.key} label={v.name} selected={name === v.name} onPress={() => pick(v.name)} dot={g === 'povinne' ? '#D92D20' : '#2E9E6B'} />
              ))}
            </View>
          </View>
        ))}
        <Card style={{ marginTop: 12, padding: 16, gap: 14 }}>
          <Field label="Jiné" value={preset ? '' : name} onChangeText={pick} placeholder="Název očkování" maxLength={80} error={tried && !name.trim() ? 'Vyberte nebo napište, proti čemu.' : null} />
          <DateField label="Kdy" value={date} onChange={(d) => (d <= today ? setDate(d) : toast('Datum očkování nemůže být v budoucnu'))} />
        </Card>

        <T w="semibold" style={{ marginTop: 20, paddingLeft: 4, fontSize: 13, color: C.muted }}>Přeočkovat</T>
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {DUE_OPTIONS.map(([y, l]) => (
            <Chip
              key={l}
              label={l}
              selected={years === y}
              onPress={() => {
                setTouchedYears(true);
                setYears(y);
              }}
            />
          ))}
        </View>
        <T style={{ marginTop: 6, paddingLeft: 4, fontSize: 12, color: C.muted }}>{nextDue ? 'Přeočkování ' + numericDate(nextDue) + (nextDue < today ? ' — už je po termínu' : '') : 'Bez přeočkování'}</T>

        <Card style={{ marginTop: 12, padding: 16 }}>
          <Field label="Poznámka" value={note} onChangeText={setNote} placeholder="Dávka, šarže, kde…" multiline maxLength={500} />
        </Card>

        <PrimaryButton style={{ marginTop: 24 }} label={rec ? 'Uložit' : 'Zapsat'} onPress={save} busy={busy} />
        {rec ? <SecondaryButton style={{ marginTop: 10 }} danger label="Smazat" icon={<IconTrash size={16} color={C.danger} width={1.8} />} onPress={remove} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

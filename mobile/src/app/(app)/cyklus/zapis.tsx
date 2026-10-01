import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useCycle } from '@/state/useCycle';
import { CYCLE_SYMPTOMS, FLOWS, PAIN_LABEL, buildCycleRecord, computeCycle, cycleLogOf, shiftFor, shiftLabel, type CycleLog, type CycleSettings, type Flow } from '@/domain/cycle';
import { diffDays, isValidLocalDate, toLocalDate } from '@/domain/dates';
import type { HcRecord } from '@/domain/types';
import { Backdrop, Card, Chip, Field, H1, LinkButton, Loading, Muted, PrimaryButton, Segmented, SecondaryButton, T, ToggleRow, TopBar, useToast } from '@/ui/kit';
import { DateField } from '@/ui/DateTimeField';
import { confirm } from '@/ui/device';
import { CY } from '@/ui/cycleViz';
import { C } from '@/ui/theme';
import { IconTrash } from '@/ui/icons';

/**
 * Zápis dne cyklu. Jeden záznam na den: když pro zvolený den už zápis
 * existuje, otevře se k úpravě. Do osy jde jako typ „Cyklus“ s podzáznamy
 * Krvácení, Příznaky, Bolest a u začátku menstruace Posun proti odhadu.
 */
export default function CyklusZapis() {
  const params = useLocalSearchParams<{ id?: string; start?: string; date?: string }>();
  const { settings, records, loading } = useCycle();
  const today = toLocalDate(new Date());

  if (loading && !records.length) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <Loading />
      </View>
    );
  }
  const date0 = params.date && isValidLocalDate(params.date) ? params.date : today;
  // Úprava existujícího zápisu (z osy, historie nebo „Dnes“).
  const rec = params.id ? records.find((r) => r.id === params.id) : records.find((r) => r.date === date0 && params.start !== '1');
  return <Form key={rec?.id ?? 'new'} settings={settings} records={records} editing={rec && cycleLogOf(rec) ? rec : null} date0={date0} start0={params.start === '1'} today={today} />;
}

function Form({ settings, records, editing, date0, start0, today }: { settings: CycleSettings; records: HcRecord[]; editing: HcRecord | null; date0: string; start0: boolean; today: string }) {
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const c0 = editing ? cycleLogOf(editing) : null;

  const [date, setDate] = useState(editing?.date ?? date0);
  const [start, setStart] = useState(!!c0?.start || start0);
  const [flow, setFlow] = useState<Flow | null>(c0?.flow ?? (start0 ? 'medium' : null));
  const [pain, setPain] = useState(c0?.pain ?? 0);
  const [symptoms, setSymptoms] = useState<string[]>(c0?.symptoms ?? []);
  const [note, setNote] = useState(editing?.description ?? '');
  const [busy, setBusy] = useState(false);

  // Odhad bez tohoto zápisu — z něj se počítá den cyklu a posun.
  const before = useMemo(() => {
    const others = records.filter((r) => r.id !== editing?.id && r.date !== date);
    return computeCycle(settings, others, date);
  }, [records, settings, editing, date]);
  const shift = start ? shiftFor(before, date) : null;
  const day = start ? 1 : before.lastStart && date >= before.lastStart ? diffDays(before.lastStart, date) + 1 : undefined;

  const toggleSym = (s: string) => setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const save = async () => {
    if (!start && !flow && !pain && !symptoms.length && !note.trim()) {
      toast('Vyberte aspoň krvácení, bolest nebo příznak');
      return;
    }
    setBusy(true);
    try {
      const log: CycleLog = { flow: flow ?? undefined, start: start || undefined, pain: pain || undefined, symptoms, day, shift: start ? shift : undefined };
      const built = buildCycleRecord(log, note);
      // Jiný zápis na stejný den se sloučí — den má mít jeden záznam cyklu.
      const sameDay = records.find((r) => r.date === date && r.id !== editing?.id);
      const target = editing ?? sameDay ?? null;
      if (target) await data.records.update(target.id, { type: 'cycle', title: built.title, description: built.description, date, time: null, metadata: built.metadata });
      else await data.records.create(person.id, { type: 'cycle', title: built.title, description: built.description, date, time: null, metadata: built.metadata });
      touch();
      toast(start ? 'Začátek menstruace zapsán do osy' : 'Zapsáno do osy');
      router.back();
    } catch {
      setBusy(false);
      toast('Uložení se nepovedlo.');
    }
  };

  const remove = async () => {
    if (!editing) return;
    if (!(await confirm('Smazat zápis?', 'Zmizí z osy i z výpočtu cyklu.', 'Smazat'))) return;
    await data.records.softDelete(editing.id);
    touch();
    toast('Zápis smazán');
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 20 : 48, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} backLabel="Zavřít" />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>{editing ? 'Upravit zápis' : 'Zápis cyklu'}</H1>
        <Muted style={{ paddingLeft: 8, marginTop: 4 }}>{day ? `${day}. den cyklu` : 'Zapíše se do časové osy'}</Muted>

        <Card style={{ marginTop: 16, padding: 16, gap: 14 }}>
          <DateField label="Den" value={date} onChange={(d) => (d <= today ? setDate(d) : toast('Zapisovat jde jen dnešek a minulé dny'))} />
          <ToggleRow title="Tento den začala menstruace" sub={start && shift != null ? shiftLabel(shift) : 'Počítá se od něj nový cyklus'} value={start} onChange={(v) => { setStart(v); if (v && !flow) setFlow('medium'); }} />
        </Card>

        <T w="semibold" style={{ marginTop: 20, paddingLeft: 4, fontSize: 13, color: C.muted }}>Síla krvácení</T>
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="Žádné" selected={!flow} onPress={() => setFlow(null)} />
          {FLOWS.map(([k, l]) => (
            <Chip key={k} label={l} selected={flow === k} onPress={() => setFlow(flow === k ? null : k)} dot={CY.pink} />
          ))}
        </View>

        <T w="semibold" style={{ marginTop: 20, paddingLeft: 4, fontSize: 13, color: C.muted }}>Bolest</T>
        <View style={{ marginTop: 8 }}>
          <Segmented label="Bolest" options={PAIN_LABEL.map((l, i) => [String(i) as '0', l])} value={String(pain) as '0'} onChange={(v) => setPain(Number(v))} />
        </View>

        <T w="semibold" style={{ marginTop: 20, paddingLeft: 4, fontSize: 13, color: C.muted }}>Příznaky</T>
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {CYCLE_SYMPTOMS.map((s) => (
            <Chip key={s} tone="orange" label={s} selected={symptoms.includes(s)} onPress={() => toggleSym(s)} />
          ))}
        </View>
        <LinkButton style={{ marginLeft: 4 }} label="Další příznaky a nálada" onPress={() => router.push('/zapis')} />

        <Card style={{ marginTop: 12, padding: 16 }}>
          <Field label="Poznámka" value={note} onChangeText={setNote} placeholder="Nepovinné" multiline maxLength={1000} />
        </Card>

        <PrimaryButton style={{ marginTop: 24 }} label={editing ? 'Uložit změny' : 'Zapsat do osy'} onPress={save} busy={busy} />
        {editing ? <SecondaryButton style={{ marginTop: 10 }} danger label="Smazat zápis" icon={<IconTrash size={16} color={C.danger} width={1.8} />} onPress={remove} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

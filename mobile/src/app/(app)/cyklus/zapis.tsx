import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, LayoutAnimation, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useCycle } from '@/state/useCycle';
import { CYCLE_SYMPTOMS, FLOWS, PAIN_LABEL, buildCycleRecord, computeCycle, cycleLogOf, shiftFor, shiftLabel, type CycleLog, type CycleSettings, type Flow } from '@/domain/cycle';
import { diffDays, isValidLocalDate, toLocalDate } from '@/domain/dates';
import type { HcRecord } from '@/domain/types';
import { Backdrop, Card, Chip, Field, H1, Loading, Muted, PrimaryButton, Segmented, SecondaryButton, T, ToggleRow, TopBar, useToast } from '@/ui/kit';
import { DateField } from '@/ui/DateTimeField';
import { confirm } from '@/ui/device';
import { CY } from '@/ui/cycleViz';
import { MOODS } from '@/domain/recordTypes';
import { C } from '@/ui/theme';
import { IconBolt, IconTrash, TypeGlyph } from '@/ui/icons';

type TabKey = 'blood' | 'mood' | 'pain';
const TABS: { k: TabKey; label: string; color: string; icon: (c: string) => React.ReactNode }[] = [
  { k: 'blood', label: 'Krvácení', color: CY.pink, icon: (c) => <TypeGlyph type="cycle" size={26} color={c} /> },
  { k: 'mood', label: 'Nálada', color: C.orange, icon: (c) => <TypeGlyph type="mood" size={25} color={c} /> },
  { k: 'pain', label: 'Bolest', color: CY.lilacStrong, icon: (c) => <IconBolt size={26} color={c} width={1.8} /> },
];

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
  const [mood, setMood] = useState<number | null>(c0?.mood ?? null);
  const [note, setNote] = useState(editing?.description ?? '');
  const [tab, setTab] = useState<TabKey | null>('blood');
  const openTab = (t: TabKey | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTab(t);
  };
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
    if (!start && !flow && !pain && !symptoms.length && mood == null && !note.trim()) {
      toast('Vyberte krvácení, náladu nebo bolest');
      return;
    }
    setBusy(true);
    try {
      const log: CycleLog = { flow: flow ?? undefined, start: start || undefined, pain: pain || undefined, symptoms, mood: mood ?? undefined, day, shift: start ? shift : undefined };
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

        <Card style={{ marginTop: 16, padding: 16 }}>
          <DateField label="Den" value={date} onChange={(d) => (d <= today ? setDate(d) : toast('Zapisovat jde jen dnešek a minulé dny'))} />
        </Card>

        {/* Tři filtry — klepnutí rozbalí nabídku pod nimi */}
        <View accessibilityRole="tablist" style={{ marginTop: 20, flexDirection: 'row', justifyContent: 'space-around' }}>
          {TABS.map((t) => {
            const on = tab === t.k;
            const filled = t.k === 'blood' ? !!flow || start : t.k === 'mood' ? mood != null : !!pain || symptoms.length > 0;
            return (
              <Pressable
                key={t.k}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t.label}
                onPress={() => openTab(on ? null : t.k)}
                style={({ pressed }) => ({ alignItems: 'center', gap: 6, width: 88, transform: [{ scale: pressed ? 0.95 : 1 }] })}
              >
                <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.color : 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: on ? t.color : C.line, boxShadow: on ? `0px 10px 24px ${t.color}55` : '0px 6px 16px rgba(40,38,48,0.06)' }}>
                  {t.icon(on ? C.white : t.color)}
                  {filled ? <View style={{ position: 'absolute', top: 4, right: 4, width: 12, height: 12, borderRadius: 6, backgroundColor: on ? C.white : t.color, borderWidth: 2, borderColor: on ? t.color : C.white }} /> : null}
                </View>
                <T w={on ? 'semibold' : 'regular'} style={{ fontSize: 13 }}>{t.label}</T>
              </Pressable>
            );
          })}
        </View>

        {tab === 'blood' ? (
          <Card style={{ marginTop: 14, padding: 16, gap: 14 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Chip label="Žádné" selected={!flow} onPress={() => setFlow(null)} />
              {FLOWS.map(([k, l]) => (
                <Chip key={k} label={l} selected={flow === k} onPress={() => setFlow(flow === k ? null : k)} dot={CY.pink} />
              ))}
            </View>
            <ToggleRow title="Tento den začala menstruace" sub={start && shift != null ? shiftLabel(shift) : 'Počítá se od něj nový cyklus'} value={start} onChange={(v) => { setStart(v); if (v && !flow) setFlow('medium'); }} />
          </Card>
        ) : null}

        {tab === 'mood' ? (
          <Card style={{ marginTop: 14, paddingVertical: 16, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
            {MOODS.map((m, i) => {
              const on = mood === i;
              return (
                <Pressable key={m.label} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={m.label} onPress={() => setMood(on ? null : i)} style={{ flex: 1, alignItems: 'center', gap: 6, opacity: mood != null && !on ? 0.5 : 1 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: m.tint, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? C.orange : 'transparent' }}>
                    <TypeGlyph type="mood" size={26} color={m.color} mouth={m.mouth} />
                  </View>
                  <T w={on ? 'semibold' : 'regular'} style={{ fontSize: 11, lineHeight: 14, textAlign: 'center' }}>{m.label}</T>
                </Pressable>
              );
            })}
          </Card>
        ) : null}

        {tab === 'pain' ? (
          <Card style={{ marginTop: 14, padding: 16, gap: 14 }}>
            <Segmented label="Bolest" options={PAIN_LABEL.map((l, i) => [String(i) as '0', l])} value={String(pain) as '0'} onChange={(v) => setPain(Number(v))} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {CYCLE_SYMPTOMS.map((sym) => (
                <Chip key={sym} tone="orange" label={sym} selected={symptoms.includes(sym)} onPress={() => toggleSym(sym)} />
              ))}
            </View>
          </Card>
        ) : null}

        <Card style={{ marginTop: 12, padding: 16 }}>
          <Field label="Poznámka" value={note} onChangeText={setNote} placeholder="Nepovinné" multiline maxLength={1000} />
        </Card>

        <PrimaryButton style={{ marginTop: 24 }} label={editing ? 'Uložit změny' : 'Zapsat do osy'} onPress={save} busy={busy} />
        {editing ? <SecondaryButton style={{ marginTop: 10 }} danger label="Smazat zápis" icon={<IconTrash size={16} color={C.danger} width={1.8} />} onPress={remove} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

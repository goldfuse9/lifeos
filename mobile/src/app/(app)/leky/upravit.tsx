import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useMeds } from '@/state/useMeds';
import { TIME_PRESETS, medChanged, medRecord, type Med, type MedChange } from '@/domain/meds';
import { toLocalDate, toLocalTime } from '@/domain/dates';
import { newId } from '@/platform/secure';
import { drugRegistryAvailable, suggestDrugs } from '@/data/drugRegistry';
import type { DrugSuggestion } from '@/domain/drugRegistry';
import { notificationPermission } from '@/platform/notifications';
import { Backdrop, Card, Chip, Field, H1, Loading, PrimaryButton, SecondaryButton, T, ToggleRow, TopBar, useToast } from '@/ui/kit';
import { TimeField } from '@/ui/DateTimeField';
import { confirm } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconClose, IconTrash } from '@/ui/icons';

/** Přidat / upravit lék — název, dávka, kdy. Nic víc není potřeba. */
export default function LekUpravit() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { meds, loading } = useMeds();
  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <Loading />
      </View>
    );
  }
  const med = params.id ? meds.find((m) => m.id === params.id) ?? null : null;
  return <Form key={med?.id ?? 'new'} meds={meds} med={med} />;
}

function Form({ meds, med }: { meds: Med[]; med: Med | null }) {
  const data = useData();
  const person = usePerson();
  const { touch, settings, updateSettings } = useSession();
  const toast = useToast();

  const [name, setName] = useState(med?.name ?? '');
  const [codes, setCodes] = useState<{ suklCode?: string; atc?: string }>({ suklCode: med?.suklCode, atc: med?.atc });
  const [picked, setPicked] = useState(!!med);
  const suggestions = !picked && name.trim().length >= 2 ? suggestDrugs(name, 5) : [];
  const pickDrug = (d: DrugSuggestion) => {
    setName(d.name);
    if (!dose.trim() && d.strength) setDose(d.strength);
    setCodes({ suklCode: d.code, atc: d.atc });
    setPicked(true);
  };
  const [dose, setDose] = useState(med?.dose ?? '');
  const [times, setTimes] = useState<string[]>(med?.times ?? ['08:00']);
  const [remind, setRemind] = useState(med?.remind ?? settings.remindersEnabled);
  const [note, setNote] = useState(med?.note ?? '');
  const [custom, setCustom] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = toLocalDate(new Date());

  const toggleTime = (t: string) => setTimes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].sort()));
  const customTimes = times.filter((t) => !TIME_PRESETS.some((p) => p[0] === t));

  const setRemindSafe = async (v: boolean) => {
    if (v && !settings.remindersEnabled) {
      if (!(await notificationPermission(true))) {
        toast('Upozornění jsou v telefonu vypnutá — povolte je v Nastavení telefonu.');
        return;
      }
      await updateSettings({ remindersEnabled: true });
    }
    setRemind(v);
  };

  const write = async (next: Med[], change: MedChange | null, m: Med) => {
    await data.personData.set(person.id, 'meds', { list: next });
    if (change) {
      const r = medRecord(change, m);
      const now = new Date();
      await data.records.create(person.id, { type: 'med', title: r.title, description: '', date: toLocalDate(now), time: toLocalTime(now), metadata: r.metadata });
    }
    touch();
  };

  const save = async () => {
    setTried(true);
    if (!name.trim()) return;
    setBusy(true);
    try {
      const next: Med = { id: med?.id ?? newId(), name: name.trim(), dose: dose.trim() || undefined, times, remind: remind && times.length > 0, active: med?.active ?? true, note: note.trim() || undefined, since: med?.since ?? today, until: med?.until, suklCode: codes.suklCode, atc: codes.atc };
      const list = med ? meds.map((m) => (m.id === med.id ? next : m)) : [...meds, next];
      const change: MedChange | null = !med ? 'start' : med.active && medChanged(med, next) ? 'change' : null;
      await write(list, change, next);
      toast(change === 'start' ? 'Lék přidán · zapsáno do osy' : 'Uloženo');
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (active: boolean) => {
    if (!med) return;
    if (!active && !(await confirm('Přestat brát?', 'Lék zmizí z dnešních dávek a z nouzové karty. Do osy se zapíše konec.', 'Přestat brát', false))) return;
    const next: Med = { ...med, active, until: active ? undefined : today, since: active ? today : med.since };
    await write(meds.map((m) => (m.id === med.id ? next : m)), active ? 'start' : 'stop', next);
    toast(active ? 'Znovu beru · zapsáno do osy' : 'Konec zapsán do osy');
    router.back();
  };

  const remove = async () => {
    if (!med) return;
    if (!(await confirm('Smazat lék?', 'Zmizí ze seznamu. Záznamy v ose zůstanou.', 'Smazat'))) return;
    await write(meds.filter((m) => m.id !== med.id), null, med);
    toast('Lék smazán');
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 20 : 48, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} backLabel="Zavřít" />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>{med ? 'Upravit lék' : 'Nový lék'}</H1>

        <Card style={{ marginTop: 16, padding: 16, gap: 14 }}>
          <Field
            label="Název"
            value={name}
            onChangeText={(v) => {
              setName(v);
              setPicked(false);
              setCodes({});
            }}
            placeholder={drugRegistryAvailable() ? 'Začněte psát, např. Euthyrox' : 'Např. Euthyrox'}
            autoCorrect={false}
            maxLength={80}
            error={tried && !name.trim() ? 'Vyplňte název.' : null}
          />
          {suggestions.length ? (
            <View accessibilityRole="list" style={{ marginTop: -6, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, overflow: 'hidden' }}>
              {suggestions.map((d, i) => (
                <Pressable key={d.code + i} accessibilityRole="button" onPress={() => pickDrug(d)} style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, backgroundColor: pressed ? '#F4F4F3' : 'transparent' })}>
                  <T w="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{[d.name, d.strength].filter(Boolean).join(' ')}</T>
                  <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{d.form}</T>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Field label="Dávka" value={dose} onChangeText={setDose} placeholder="1 tableta, 50 µg, 10 kapek…" maxLength={60} />
        </Card>

        <T w="semibold" style={{ marginTop: 20, paddingLeft: 4, fontSize: 13, color: C.muted }}>Kdy</T>
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {TIME_PRESETS.map(([t, l]) => (
            <Chip key={t} label={`${l} ${t.replace(/^0/, '')}`} selected={times.includes(t)} onPress={() => toggleTime(t)} dot="#D9920F" />
          ))}
          {customTimes.map((t) => (
            <Pressable key={t} accessibilityRole="button" accessibilityLabel={'Odebrat ' + t} onPress={() => toggleTime(t)} style={{ minHeight: 40, paddingLeft: 14, paddingRight: 10, borderRadius: 20, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T w="semibold" style={{ fontSize: 14, color: C.white }}>{t.replace(/^0/, '')}</T>
              <IconClose size={14} color={C.white} />
            </Pressable>
          ))}
          <Chip label="+ Jiný čas" selected={false} onPress={() => setCustom('07:00')} />
        </View>
        {custom ? (
          <Card style={{ marginTop: 8, padding: 16, gap: 10 }}>
            <TimeField label="Čas" date={today} value={custom} onChange={setCustom} />
            <PrimaryButton
              label="Přidat čas"
              onPress={() => {
                if (!times.includes(custom)) setTimes((cur) => [...cur, custom].sort());
                setCustom(null);
              }}
            />
          </Card>
        ) : null}
        <T style={{ marginTop: 6, paddingLeft: 4, fontSize: 12, color: C.muted }}>{times.length ? 'Každý den v tyto časy.' : 'Bez času = podle potřeby.'}</T>

        <Card style={{ marginTop: 12, overflow: 'hidden' }}>
          <ToggleRow title="Připomínat" sub={times.length ? 'Upozornění v čas dávky' : 'Vyberte čas'} value={remind && times.length > 0} onChange={setRemindSafe} disabled={!times.length} />
        </Card>

        <Card style={{ marginTop: 12, padding: 16 }}>
          <Field label="Poznámka" value={note} onChangeText={setNote} placeholder="Na co, po jídle, kdo předepsal…" multiline maxLength={500} />
        </Card>

        <PrimaryButton style={{ marginTop: 24 }} label={med ? 'Uložit' : 'Přidat lék'} onPress={save} busy={busy} />
        {med ? (
          <>
            <SecondaryButton style={{ marginTop: 10 }} label={med.active ? 'Přestat brát' : 'Znovu začít brát'} onPress={() => setActive(!med.active)} />
            <SecondaryButton style={{ marginTop: 10 }} danger label="Smazat" icon={<IconTrash size={16} color={C.danger} width={1.8} />} onPress={remove} />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

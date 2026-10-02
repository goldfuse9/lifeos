import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { parseScan, type DocKind, type ScanResult } from '@/domain/scanParse';
import { medChanged, medRecord, medSchedule, TIME_PRESETS, type Med } from '@/domain/meds';
import { numericDate, toLocalDate, toLocalTime } from '@/domain/dates';
import type { RecordChild } from '@/domain/types';
import { findDrugInLine } from '@/data/drugRegistry';
import { recognizeText } from '@/platform/ocr';
import { newId } from '@/platform/secure';
import type { PickedFile } from '@/services/attachments';
import { Backdrop, Callout, Card, Chip, Field, H1, Loading, Muted, Note, PrimaryButton, SecondaryButton, T, TopBar, useToast } from '@/ui/kit';
import { DateField, TimeField } from '@/ui/DateTimeField';
import { chooseSource, pickFrom } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconCamera, IconCheck, IconChevronDown, TypeGlyph } from '@/ui/icons';

/**
 * Chytrý skener — vyfocená zpráva, recept nebo žádanka → návrh zápisu:
 * dokument do osy (s fotkou a rozpoznaným textem pro hledání), léky do
 * Léků, kontrola do kalendáře s připomínkou. Nic se neuloží bez kontroly.
 * Text čte telefon sám (ML Kit), nic neodchází na internet.
 */

interface MedDraft {
  key: string;
  sel: boolean;
  name: string;
  dose: string;
  times: string[];
  line: string;
  code?: string;
  atc?: string;
}

const KINDS: [DocKind, string][] = [
  ['zprava', 'Zpráva'],
  ['recept', 'Recept'],
  ['zadanka', 'Žádanka'],
];

export default function Skener() {
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  const pick = async () => {
    setErr(null);
    const src = await chooseSource('Vyfoťte zprávu, recept nebo žádanku');
    if (!src || src === 'file') {
      if (src === 'file') setErr('Skener čte fotky. PDF nahrajte v Dokumentech.');
      return;
    }
    const picked = await pickFrom(src);
    if (!picked[0]) return;
    setPhoto(picked[0]);
    setText(null);
    try {
      setText(await recognizeText(picked[0].uri));
    } catch {
      setErr('Text se nepodařilo přečíst. Zkuste ostřejší fotku s dobrým světlem.');
      setPhoto(null);
    }
  };

  // Hned po otevření nabídnout vyfocení.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    pick();
  }, []);

  if (photo && text != null) return <Review photo={photo} text={text} onRetake={pick} />;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 20 : 48, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title="Skener" backLabel="Zavřít" />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>Chytrý skener</H1>
        <Muted style={{ paddingLeft: 8, marginTop: 4 }}>Zpráva, recept nebo žádanka → léky, kontrola a zápis do osy.</Muted>
        {photo ? (
          <Card style={{ marginTop: 16, padding: 16, alignItems: 'center', gap: 12 }}>
            <Image source={{ uri: photo.uri }} style={{ width: 120, height: 160, borderRadius: 12 }} resizeMode="cover" />
            <Loading />
            <Muted>Čtu text…</Muted>
          </Card>
        ) : (
          <PrimaryButton style={{ marginTop: 20 }} label="Vyfotit dokument" onPress={pick} />
        )}
        {err ? <Callout title="Nepovedlo se" style={{ marginTop: 16 }}>{err}</Callout> : null}
        <Note style={{ marginTop: 16 }}>Text čte přímo telefon, fotka nikam neodchází. Výsledek je návrh — před uložením ho zkontrolujete.</Note>
      </ScrollView>
    </View>
  );
}

function Review({ photo, text, onRetake }: { photo: PickedFile; text: string; onRetake: () => void }) {
  const data = useData();
  const person = usePerson();
  const { touch, settings } = useSession();
  const toast = useToast();
  const today = toLocalDate(new Date());

  const [r] = useState<ScanResult>(() =>
    parseScan(text, today, (line) => {
      const d = findDrugInLine(line);
      return d ? { name: d.name, strength: d.strength } : null;
    }),
  );
  const [kind, setKind] = useState<DocKind>(r.kind);
  const [title, setTitle] = useState(r.title);
  const [titleTouched, setTitleTouched] = useState(false);
  const [date, setDate] = useState(r.date ?? today);
  const [meds, setMeds] = useState<MedDraft[]>(() =>
    r.meds.map((m, i) => {
      const d = findDrugInLine(m.line);
      return { key: String(i), sel: true, name: m.name, dose: m.dose ?? '', times: m.times, line: m.line, code: d?.code, atc: d?.atc };
    }),
  );
  const [openMed, setOpenMed] = useState<string | null>(null);
  const [follow, setFollow] = useState(!!r.followUp);
  const [fDate, setFDate] = useState(r.followUp?.date ?? today);
  const [fTime, setFTime] = useState<string | null>(r.followUp?.time ?? null);
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState(false);

  const setMed = (key: string, patch: Partial<MedDraft>) => setMeds((cur) => cur.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  const nothing = !text.trim();

  const save = async () => {
    setBusy(true);
    try {
      const chosen = meds.filter((m) => m.sel && m.name.trim());
      // 1) Dokument do osy s fotkou a textem (text slouží k hledání)
      const children: RecordChild[] = [];
      if (r.doctor) children.push({ label: 'Lékař', value: r.doctor, type: 'visit' });
      if (r.diagnoses.length) children.push({ label: 'Diagnózy', value: r.diagnoses.join(', '), type: 'note' });
      if (chosen.length) children.push({ label: 'Léky', value: chosen.map((m) => [m.name, m.dose].filter(Boolean).join(' ')).join(', '), type: 'med' });
      if (follow) children.push({ label: 'Kontrola', value: numericDate(fDate) + (fTime ? ' ' + fTime : ''), type: 'event' });
      const now = new Date();
      const doc = await data.records.create(person.id, {
        type: 'doc',
        title: title.trim() || 'Dokument',
        description: '',
        date,
        time: date === today ? toLocalTime(now) : null,
        metadata: { children, ocr: text.slice(0, 8000), scan: { kind, diagnoses: r.diagnoses }, ...(r.doctor ? { place: r.doctor } : {}) },
      });
      const ext = /\.[a-z0-9]{1,6}$/i.exec(photo.name)?.[0] ?? '.jpg';
      await data.files.add(doc.id, person.id, { ...photo, name: (title.trim() || 'Dokument') + ext });

      // 2) Léky
      if (chosen.length) {
        const list = ((await data.personData.get(person.id, 'meds')).list ?? []).slice();
        for (const m of chosen) {
          const i = list.findIndex((x) => x.active && x.name.toLowerCase() === m.name.trim().toLowerCase());
          const base: Med = i >= 0 ? list[i] : { id: newId(), name: m.name.trim(), times: [], remind: false, active: true, since: date };
          const next: Med = { ...base, name: m.name.trim(), dose: m.dose.trim() || base.dose, times: m.times, remind: settings.remindersEnabled && m.times.length > 0, suklCode: m.code ?? base.suklCode, atc: m.atc ?? base.atc, note: base.note ?? `Podle dokumentu z ${numericDate(date)}` };
          if (i >= 0) {
            if (medChanged(list[i], next)) {
              const rec = medRecord('change', next);
              await data.records.create(person.id, { type: 'med', title: rec.title, description: '', date: today, time: toLocalTime(now), metadata: rec.metadata });
            }
            list[i] = next;
          } else {
            list.push(next);
            const rec = medRecord('start', next);
            await data.records.create(person.id, { type: 'med', title: rec.title, description: '', date: today, time: toLocalTime(now), metadata: rec.metadata });
          }
        }
        await data.personData.set(person.id, 'meds', { list });
      }

      // 3) Kontrola do kalendáře s připomínkou
      if (follow) {
        await data.records.create(person.id, {
          type: 'visit',
          title: 'Kontrola' + (r.doctor ? ' · ' + r.doctor : ''),
          description: 'Podle dokumentu z ' + numericDate(date),
          date: fDate,
          time: fTime,
          metadata: { ...(r.doctor ? { place: r.doctor } : {}), ...(settings.remindersEnabled ? { remind: settings.remindDefault } : {}) },
        });
      }
      touch();
      const parts = ['dokument', chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'lék' : chosen.length < 5 ? 'léky' : 'léků'}` : null, follow ? 'kontrola' : null].filter(Boolean);
      toast('Uloženo: ' + parts.join(', '));
      router.replace(`/zaznam/${doc.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Uložení se nepovedlo.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 20 : 48, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} backLabel="Zavřít" />
        <View style={{ marginTop: 18, paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={{ uri: photo.uri }} style={{ width: 54, height: 72, borderRadius: 10 }} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <H1>Zkontrolujte</H1>
            <Muted>Uloží se jen to, co je zaškrtnuté.</Muted>
          </View>
        </View>

        {nothing ? <Callout title="Na fotce není čitelný text" style={{ marginTop: 16 }}>Zkuste fotku znovu — rovně, ostře a s dobrým světlem. Dokument jde uložit i tak.</Callout> : null}

        {/* Dokument */}
        <Section icon={<TypeGlyph type="doc" color="#E0613B" size={14} />} title="Do osy" />
        <Card style={{ marginTop: 8, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {KINDS.map(([k, l]) => (
              <Chip
                key={k}
                label={l}
                selected={kind === k}
                onPress={() => {
                  setKind(k);
                  if (!titleTouched) setTitle((k === 'zprava' ? 'Lékařská zpráva' : l) + (r.doctor && k === 'zprava' ? ' · ' + r.doctor : ''));
                }}
              />
            ))}
          </View>
          <Field label="Název" value={title} onChangeText={(v) => { setTitle(v); setTitleTouched(true); }} maxLength={140} />
          <DateField label="Datum dokumentu" value={date} onChange={(d) => (d <= today ? setDate(d) : toast('Datum dokumentu nemůže být v budoucnu'))} />
          {r.diagnoses.length ? <Muted style={{ fontSize: 13 }}>Diagnózy: {r.diagnoses.join(', ')}</Muted> : null}
        </Card>

        {/* Léky */}
        <Section icon={<TypeGlyph type="med" color="#D9920F" size={14} />} title={meds.length ? 'Léky' : 'Léky — nic nenalezeno'} />
        {meds.length ? (
          <Card style={{ marginTop: 8, overflow: 'hidden', borderRadius: 22 }}>
            {meds.map((m, i) => (
              <View key={m.key} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ minHeight: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Check on={m.sel} onPress={() => setMed(m.key, { sel: !m.sel })} label={m.name} />
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: openMed === m.key }} onPress={() => setOpenMed(openMed === m.key ? null : m.key)} style={{ flex: 1, paddingVertical: 10 }}>
                    <T w="semibold" numberOfLines={1} style={{ fontSize: 15, color: m.sel ? C.ink : C.muted }}>{[m.name, m.dose].filter(Boolean).join(' ')}</T>
                    <T numberOfLines={1} style={{ fontSize: 13, color: C.muted }}>{medSchedule({ times: m.times })} · upravit</T>
                  </Pressable>
                  <View style={{ transform: [{ rotate: openMed === m.key ? '180deg' : '0deg' }] }}>
                    <IconChevronDown size={16} color={C.muted} />
                  </View>
                </View>
                {openMed === m.key ? (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                    <T style={{ fontSize: 12, color: C.muted }}>Z textu: „{m.line}“</T>
                    <Field label="Název" value={m.name} onChangeText={(v) => setMed(m.key, { name: v, code: undefined, atc: undefined })} />
                    <Field label="Dávka" value={m.dose} onChangeText={(v) => setMed(m.key, { dose: v })} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {TIME_PRESETS.map(([t, l]) => (
                        <Chip key={t} label={`${l} ${t.replace(/^0/, '')}`} selected={m.times.includes(t)} onPress={() => setMed(m.key, { times: m.times.includes(t) ? m.times.filter((x) => x !== t) : [...m.times, t].sort() })} />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        ) : (
          <Muted style={{ marginTop: 6, paddingHorizontal: 8, fontSize: 13 }}>Léky s dávkováním (např. „1-0-1“) se v textu nenašly. Přidáte je v Lécích.</Muted>
        )}

        {/* Kontrola */}
        <Section icon={<TypeGlyph type="event" color={C.orange} size={14} />} title={r.followUp ? 'Kontrola' : 'Kontrola — v textu nenalezena'} />
        <Card style={{ marginTop: 8, overflow: 'hidden', borderRadius: 22 }}>
          <View style={{ minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Check on={follow} onPress={() => setFollow(!follow)} label="Kontrola" />
            <View style={{ flex: 1 }}>
              <T w="semibold" style={{ fontSize: 15, color: follow ? C.ink : C.muted }}>{follow ? 'Do kalendáře: ' + numericDate(fDate) + (fTime ? ' v ' + fTime.replace(/^0/, '') : '') : 'Naplánovat kontrolu'}</T>
              {r.followUp ? <T numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>„{r.followUp.line}“</T> : null}
            </View>
          </View>
          {follow ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
              <DateField label="Datum" value={fDate} onChange={setFDate} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T w="semibold" style={{ fontSize: 15 }}>Znám čas</T>
                <Switch accessibilityLabel="Znám čas" value={fTime != null} onValueChange={(v) => setFTime(v ? '08:00' : null)} trackColor={{ true: C.ink, false: '#E6E5E2' }} thumbColor={C.white} ios_backgroundColor="#E6E5E2" />
              </View>
              {fTime != null ? <TimeField label="Čas" date={fDate} value={fTime} onChange={setFTime} /> : null}
              <Muted style={{ fontSize: 12 }}>{settings.remindersEnabled ? 'Připomínka podle nastavení upozornění.' : 'Připomínky zapnete v Já → Upozornění.'}</Muted>
            </View>
          ) : null}
        </Card>

        {/* Rozpoznaný text */}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showText }} onPress={() => setShowText((v) => !v)} style={{ marginTop: 16, minHeight: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T w="semibold" style={{ fontSize: 14, color: C.muted }}>Rozpoznaný text</T>
          <View style={{ transform: [{ rotate: showText ? '180deg' : '0deg' }] }}>
            <IconChevronDown size={16} color={C.muted} />
          </View>
        </Pressable>
        {showText ? (
          <Card style={{ padding: 14 }}>
            <T selectable style={{ fontSize: 13, lineHeight: 19, color: C.ink2 }}>{text || '—'}</T>
          </Card>
        ) : null}

        <PrimaryButton style={{ marginTop: 20 }} label="Uložit vybrané" onPress={save} busy={busy} />
        <SecondaryButton style={{ marginTop: 10 }} label="Vyfotit znovu" icon={<IconCamera size={16} color={C.ink} />} onPress={onRetake} />
        <Note style={{ marginTop: 16 }}>Čtení textu se může splést — hlavně u dávek léků. Zkontrolujte je podle papíru; při nejasnosti se zeptejte lékaře nebo lékárníka.</Note>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={{ marginTop: 20, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon}
      <T w="semibold" style={{ fontSize: 13, color: C.muted }}>{title}</T>
    </View>
  );
}

function Check({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 9, borderWidth: 1.5, borderColor: on ? C.ink : '#CFCDD2', backgroundColor: on ? C.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <IconCheck size={15} color={C.white} width={2.4} /> : null}
    </Pressable>
  );
}

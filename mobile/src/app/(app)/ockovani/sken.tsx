import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { VAX_CATALOG, parseVaxCard } from '@/domain/vaccineCatalog';
import { addYears, vaccineOf, vaccineRecord } from '@/domain/vaccines';
import { datesIn } from '@/domain/scanParse';
import { toLocalDate, toLocalTime } from '@/domain/dates';
import { recognizeText } from '@/platform/ocr';
import type { PickedFile } from '@/services/attachments';
import { Backdrop, Callout, Card, H1, Loading, Muted, Note, PrimaryButton, SecondaryButton, T, TopBar, useToast } from '@/ui/kit';
import { DateField } from '@/ui/DateTimeField';
import { chooseSource, pickFrom } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconCamera, IconCheck } from '@/ui/icons';

/**
 * Očkovací průkaz → očkování. Telefon přečte text z fotky, najde dvojice
 * „vakcína + datum“ a ukáže je ke kontrole. Fotka se uloží ke kartě jako
 * „Očkovací průkaz“, očkování jako záznamy v ose.
 */

interface Draft {
  key: string;
  sel: boolean;
  name: string;
  date: string;
  line: string;
  dup: boolean;
}

export default function OckovaniSken() {
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const today = toLocalDate(new Date());
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const pick = async () => {
    setErr(null);
    const src = await chooseSource('Vyfoťte stránku očkovacího průkazu');
    if (!src || src === 'file') return;
    const picked = await pickFrom(src);
    if (!picked[0]) return;
    setPhoto(picked[0]);
    setRows(null);
    setReading(true);
    try {
      const text = await recognizeText(picked[0].uri);
      const existing = await data.records.query({ personId: person.id, types: ['vaccine'] });
      const have = new Set(existing.map((r) => (vaccineOf(r)?.name ?? '') + '|' + r.date));
      setRows(parseVaxCard(text, today, datesIn).map((e, i) => ({ key: String(i), sel: !have.has(e.name + '|' + e.date), name: e.name, date: e.date, line: e.line, dup: have.has(e.name + '|' + e.date) })));
    } catch {
      setErr('Text se nepodařilo přečíst. Zkuste ostřejší fotku s dobrým světlem.');
    } finally {
      setReading(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    pick();
    // Jen jednou při otevření.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key: string, patch: Partial<Draft>) => setRows((cur) => (cur ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      const chosen = (rows ?? []).filter((r) => r.sel);
      // Přeočkování jen u poslední dávky každého očkování
      const latest = new Map<string, string>();
      for (const r of chosen) if (!latest.has(r.name) || r.date > latest.get(r.name)!) latest.set(r.name, r.date);
      for (const r of chosen) {
        const def = VAX_CATALOG.find((d) => d.name === r.name);
        const nextDue = def?.boosterYears && latest.get(r.name) === r.date ? addYears(r.date, def.boosterYears) : null;
        const rec = vaccineRecord({ name: r.name, nextDue });
        await data.records.create(person.id, { type: 'vaccine', title: rec.title, description: 'Z očkovacího průkazu', date: r.date, time: null, metadata: rec.metadata });
      }
      // Fotka ke kartě „Očkovací průkaz“
      const docs = await data.personData.get(person.id, 'docs');
      let id = docs.vaxRecordId && (await data.records.get(docs.vaxRecordId)) ? docs.vaxRecordId : null;
      if (!id) {
        const now = new Date();
        id = (await data.records.create(person.id, { type: 'doc', title: 'Očkovací průkaz', description: '', date: toLocalDate(now), time: toLocalTime(now) })).id;
        await data.personData.set(person.id, 'docs', { ...docs, vaxRecordId: id });
      }
      const n = (await data.attachments.forRecord(id)).length;
      const ext = /\.[a-z0-9]{1,6}$/i.exec(photo.name)?.[0] ?? '.jpg';
      await data.files.add(id, person.id, { ...photo, name: `Očkovací průkaz ${n + 1}${ext}` });
      touch();
      toast(chosen.length ? `Zapsáno očkování: ${chosen.length} · fotka uložena` : 'Fotka průkazu uložena');
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Uložení se nepovedlo.');
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 20 : 48, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} backLabel="Zavřít" />
        <View style={{ marginTop: 18, paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {photo ? <Image source={{ uri: photo.uri }} style={{ width: 54, height: 72, borderRadius: 10 }} resizeMode="cover" /> : null}
          <View style={{ flex: 1 }}>
            <H1>Očkovací průkaz</H1>
            <Muted>{rows ? 'Zkontrolujte data podle průkazu' : 'Vyfoťte stránku se záznamy'}</Muted>
          </View>
        </View>

        {reading ? (
          <Card style={{ marginTop: 16, padding: 20, alignItems: 'center', gap: 8 }}>
            <Loading />
            <Muted>Čtu průkaz…</Muted>
          </Card>
        ) : null}
        {err ? <Callout title="Nepovedlo se" style={{ marginTop: 16 }}>{err}</Callout> : null}

        {rows ? (
          rows.length ? (
            <Card style={{ marginTop: 16, overflow: 'hidden', borderRadius: 22 }}>
              {rows.map((r, i) => (
                <View key={r.key} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: C.line, padding: 12, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: r.sel }} accessibilityLabel={r.name} onPress={() => set(r.key, { sel: !r.sel })} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 9, borderWidth: 1.5, borderColor: r.sel ? C.ink : '#CFCDD2', backgroundColor: r.sel ? C.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {r.sel ? <IconCheck size={15} color={C.white} width={2.4} /> : null}
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <T w="semibold" style={{ fontSize: 15, color: r.sel ? C.ink : C.muted }}>{r.name}</T>
                      <T numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{r.dup ? 'Už zapsáno · ' : ''}„{r.line}“</T>
                    </View>
                  </View>
                  {r.sel ? <DateField label="Datum" value={r.date} onChange={(d) => (d <= today ? set(r.key, { date: d }) : toast('Datum nemůže být v budoucnu'))} /> : null}
                </View>
              ))}
            </Card>
          ) : (
            <Callout title="V textu jsem nenašel očkování" style={{ marginTop: 16 }}>
              Fotka se uloží k průkazu. Očkování zapíšete ručně tlačítkem Zapsat — nebo zkuste fotku znovu, rovně a ostře.
            </Callout>
          )
        ) : null}

        {rows ? <PrimaryButton style={{ marginTop: 20 }} label={rows.some((r) => r.sel) ? `Uložit ${rows.filter((r) => r.sel).length} a fotku` : 'Uložit jen fotku'} onPress={save} busy={busy} /> : null}
        <SecondaryButton style={{ marginTop: 10 }} label={photo ? 'Vyfotit jinou stránku' : 'Vyfotit'} icon={<IconCamera size={16} color={C.ink} />} onPress={pick} />
        <Note style={{ marginTop: 16 }}>Text čte telefon, fotka nikam neodchází. Rozpoznávání se může splést — data porovnejte s průkazem. Poznám {VAX_CATALOG.length} druhů očkování včetně obchodních názvů (Infanrix hexa, Priorix, Boostrix, FSME-Immun…).</Note>
      </ScrollView>
    </View>
  );
}

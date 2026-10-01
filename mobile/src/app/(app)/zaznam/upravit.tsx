import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { EDITABLE_TYPES, RECORD_TYPES, isRecordType } from '@/domain/recordTypes';
import { isValidLocalDate, toLocalDate, toLocalTime } from '@/domain/dates';
import type { HcRecord, RecordMetadata, RecordType } from '@/domain/types';
import type { PickedFile } from '@/services/attachments';
import { Backdrop, Card, Chip, Field, H1, Loading, PrimaryButton, Segmented, T, TopBar, useScreenInsets, useToast } from '@/ui/kit';
import { DateField, TimeField } from '@/ui/DateTimeField';
import { isPending } from '@/domain/timeline';
import { chooseSource, confirm, pickFrom } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconClip, IconClose } from '@/ui/icons';

/**
 * Nový záznam / úprava. Jeden formulář pro osu i kalendář — kalendář sem
 * jen předá datum a typ „Termín“.
 *
 * Povinný je jen název. Všechno ostatní má rozumné výchozí hodnoty, aby
 * se zápis dal udělat za pár vteřin.
 */

const PLACEHOLDER: Record<RecordType, string> = {
  event: 'Např. Odběr krve',
  visit: 'Např. Kontrola u praktika',
  symptom: 'Např. Bolest hlavy',
  result: 'Např. Krevní tlak 120/80',
  med: 'Např. Ibalgin 400 mg',
  doc: 'Např. Lékařská zpráva',
  note: 'Např. Prořezává se zub',
  mood: '',
  cycle: '',
};

const WITH_PLACE: RecordType[] = ['event', 'visit', 'result'];

export default function RecordEditor() {
  const params = useLocalSearchParams<{ id?: string; date?: string; type?: string }>();
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const ins = useScreenInsets();
  const navigation = useNavigation();

  const [loaded, setLoaded] = useState<HcRecord | null | undefined>(params.id ? undefined : null);
  const now = new Date();
  const initialDate = params.date && isValidLocalDate(params.date) ? params.date : toLocalDate(now);
  const initialType: RecordType = isRecordType(params.type) ? params.type : 'note';
  const defaultTime = initialDate > toLocalDate(now) ? '09:00' : toLocalTime(now);

  const [type, setType] = useState<RecordType>(initialType);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState(defaultTime);
  const [place, setPlace] = useState('');
  const [description, setDescription] = useState('');
  const [assess, setAssess] = useState<'none' | 'ok' | 'warn'>('none');
  const [staged, setStaged] = useState<PickedFile[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [whenOpen, setWhenOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Posluchač „beforeRemove“ čte ref, ne stav — po uložení se musí odejít hned.
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (!params.id) return;
    data.records.get(String(params.id)).then((r) => {
      setLoaded(r);
      if (!r) return;
      setType(r.type);
      setTitle(r.title);
      setDate(r.date);
      setAllDay(r.time == null);
      setTime(r.time ?? '09:00');
      setPlace(r.metadata.place ?? '');
      setDescription(r.description);
      setAssess(r.metadata.badge ? (r.metadata.badgeTone === 'warn' ? 'warn' : 'ok') : 'none');
    });
  }, [params.id, data]);

  // Neuložené změny se nezahodí potichu.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      confirm('Zahodit změny?', 'Neuložené změny se ztratí.', 'Zahodit').then((ok) => {
        if (ok) navigation.dispatch(e.data.action);
      });
    });
    return unsub;
  }, [navigation]);

  const set = <V,>(fn: (v: V) => void) => (v: V) => {
    setDirty(true);
    fn(v);
  };

  const isEdit = !!params.id;
  const showWhen = isEdit || whenOpen || type === 'event' || initialDate !== toLocalDate(now);
  const isMood = type === 'mood';
  const titleError = !title.trim() ? 'Vyplňte název.' : null;

  const typeChips = useMemo(() => (isMood ? [] : EDITABLE_TYPES), [isMood]);

  const addStaged = async () => {
    const src = await chooseSource('Přidat přílohu');
    if (!src) return;
    const picked = await pickFrom(src);
    if (picked.length) {
      setDirty(true);
      setStaged((s) => [...s, ...picked]);
    }
  };

  const save = async () => {
    setTried(true);
    if (titleError) return;
    setBusy(true);
    try {
      const prevMeta: RecordMetadata = loaded?.metadata ?? {};
      const metadata: RecordMetadata = { ...prevMeta };
      if (WITH_PLACE.includes(type) && place.trim()) metadata.place = place.trim();
      else delete metadata.place;
      if (type === 'result' && assess !== 'none') {
        metadata.badge = assess === 'ok' ? 'V normě' : 'Mimo normu';
        metadata.badgeTone = assess;
      } else if (type !== 'result' || assess === 'none') {
        delete metadata.badge;
        delete metadata.badgeTone;
      }
      const draft = { type, title, description, date, time: allDay ? null : time, metadata };
      const rec = isEdit && loaded ? await data.records.update(loaded.id, draft) : await data.records.create(person.id, draft);
      let failed = 0;
      for (const f of staged) {
        try {
          await data.files.add(rec.id, rec.personId, f);
        } catch {
          failed++;
        }
      }
      touch();
      toast(failed ? `Uloženo, ale ${failed} ${failed === 1 ? 'soubor se nepovedl' : 'soubory se nepovedly'}` : isEdit ? 'Změny uloženy' : isPending(rec, new Date()) ? 'Naplánováno · do osy se propíše hodinu po termínu' : 'Zapsáno do osy');
      dirtyRef.current = false;
      setDirty(false);
      setBusy(false);
      router.back();
    } catch (e) {
      setBusy(false);
      toast(e instanceof Error ? e.message : 'Uložení se nepovedlo.');
    }
  };

  if (loaded === undefined) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <Loading />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 20 : ins.top, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} backLabel="Zavřít" />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>{isEdit ? 'Upravit záznam' : 'Nový záznam'}</H1>

        {typeChips.length ? (
          <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {typeChips.map((k) => (
              <Chip key={k} label={RECORD_TYPES[k].label} selected={type === k} dot={RECORD_TYPES[k].color} onPress={() => set(setType)(k)} />
            ))}
          </View>
        ) : (
          <T w="semibold" style={{ marginTop: 12, paddingLeft: 8, color: RECORD_TYPES[type].text }}>{RECORD_TYPES[type].label}</T>
        )}

        <Card style={{ marginTop: 16, padding: 16, gap: 14 }}>
          <Field label="Název" value={title} onChangeText={set(setTitle)} placeholder={PLACEHOLDER[type]} returnKeyType="next" error={tried ? titleError : null} maxLength={140} />
          {showWhen ? (
            <>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <DateField label="Datum" value={date} onChange={set(setDate)} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T w="semibold" style={{ fontSize: 15 }}>Celý den</T>
                <Switch accessibilityLabel="Celý den" value={allDay} onValueChange={set(setAllDay)} trackColor={{ true: C.ink, false: '#E6E5E2' }} thumbColor={C.white} ios_backgroundColor="#E6E5E2" />
              </View>
              {!allDay ? <TimeField label="Čas" date={date} value={time} onChange={set(setTime)} /> : null}
            </>
          ) : (
            // Nový zápis „teď“ — den člověk zná, pole by jen překážela.
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setWhenOpen(true)} style={{ alignSelf: 'flex-start' }}>
              <T style={{ fontSize: 13, color: C.muted, textDecorationLine: 'underline' }}>Jiný den nebo čas (naplánovat)</T>
            </Pressable>
          )}
          {WITH_PLACE.includes(type) ? <Field label="Kde / u koho" value={place} onChangeText={set(setPlace)} placeholder="Např. MUDr. Nováková, Poliklinika" maxLength={140} /> : null}
          {type === 'result' ? (
            <View style={{ gap: 6 }}>
              <T w="semibold" style={{ fontSize: 13, color: C.muted }}>Hodnocení</T>
              <Segmented
                label="Hodnocení výsledku"
                options={[['none', 'Bez'], ['ok', 'V normě'], ['warn', 'Mimo normu']]}
                value={assess}
                onChange={set(setAssess)}
              />
            </View>
          ) : null}
          <Field label="Poznámka" value={description} onChangeText={set(setDescription)} placeholder="Co je potřeba si pamatovat" multiline maxLength={4000} />
        </Card>

        {!isEdit ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            {staged.map((f, i) => (
              <View key={f.uri + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 14, paddingRight: 6, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }}>
                <IconClip size={16} color={C.muted} />
                <T numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>{f.name}</T>
                <Pressable accessibilityRole="button" accessibilityLabel={'Odebrat ' + f.name} onPress={() => setStaged((s) => s.filter((_, j) => j !== i))} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <IconClose size={16} color={C.muted} />
                </Pressable>
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={addStaged} style={({ pressed }) => ({ minHeight: 52, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DCDAD6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}>
              <IconClip size={18} color={C.muted} />
              <T w="semibold" style={{ fontSize: 14, color: C.muted }}>Přidat přílohu</T>
            </Pressable>
          </View>
        ) : (
          <T style={{ marginTop: 12, paddingHorizontal: 8, fontSize: 13, color: C.muted }}>Přílohy přidáte a odeberete v detailu záznamu.</T>
        )}

        <PrimaryButton style={{ marginTop: 24 }} label={isEdit ? 'Uložit změny' : 'Uložit'} onPress={save} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

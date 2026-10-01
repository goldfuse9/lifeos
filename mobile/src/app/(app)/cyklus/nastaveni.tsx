import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useCycle } from '@/state/useCycle';
import { CYCLE_DEFAULTS, type CycleInfo, type CycleSettings } from '@/domain/cycle';
import { addDays, plural, toLocalDate } from '@/domain/dates';
import { Backdrop, Card, Divider, H1, Muted, Note, PrimaryButton, SecondaryButton, ToggleRow, TopBar, useToast } from '@/ui/kit';
import { DateField } from '@/ui/DateTimeField';
import { Stepper } from '@/ui/cycleViz';
import { confirm } from '@/ui/device';

/**
 * Upravit cyklus — kvůli nepravidelnosti: obvyklá délka, délka
 * menstruace, nepravidelný cyklus, začátek bez zápisu, zobrazení na
 * Přehledu, vypnutí sledování.
 */
export default function CyklusNastaveni() {
  const { settings, info, loading } = useCycle();
  if (loading && !info) return <Backdrop />;
  return <Form settings={settings} info={info} />;
}

function Form({ settings, info }: { settings: CycleSettings; info: CycleInfo | null }) {
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const today = toLocalDate(new Date());

  const [len, setLen] = useState(settings.cycleLength ?? CYCLE_DEFAULTS.cycleLength);
  const [period, setPeriod] = useState(settings.periodLength ?? CYCLE_DEFAULTS.periodLength);
  const [irregular, setIrregular] = useState(!!settings.irregular);
  const [hide, setHide] = useState(!!settings.hideOnOverview);
  const [lastStart, setLastStart] = useState(settings.lastStart ?? info?.lastStart ?? addDays(today, -14));
  const [busy, setBusy] = useState(false);

  const days = (n: number) => plural(n, 'den', 'dny', 'dní');
  const hasLogs = !!info?.history.some((h) => h.recordId);

  const save = async () => {
    setBusy(true);
    try {
      await data.personData.set(person.id, 'cycle', { ...settings, enabled: true, cycleLength: len, periodLength: period, irregular, hideOnOverview: hide, lastStart: lastStart <= today ? lastStart : today });
      touch();
      toast('Cyklus upraven');
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!(await confirm('Přestat sledovat cyklus?', 'Zápisy v časové ose zůstanou. Sledování jde kdykoli znovu zapnout.', 'Přestat sledovat'))) return;
    await data.personData.set(person.id, 'cycle', { ...settings, enabled: false });
    touch();
    toast('Sledování cyklu vypnuto');
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>Upravit cyklus</H1>
        <Muted style={{ paddingLeft: 8, marginTop: 4 }}>
          {hasLogs ? `Ze zápisů vychází průměr ${info!.avgLength} ${days(info!.avgLength)}. Údaje níže platí, dokud nejsou zapsané aspoň dva cykly.` : 'Podle těchto údajů se počítá odhad, dokud nepřibudou zápisy.'}
        </Muted>

        <Card style={{ marginTop: 16, padding: 16, gap: 16 }}>
          <Stepper label="Obvyklá délka cyklu" value={len} min={20} max={45} unit={days} onChange={setLen} />
          <Stepper label="Délka menstruace" value={period} min={2} max={10} unit={days} onChange={setPeriod} />
        </Card>

        <Card style={{ marginTop: 12, overflow: 'hidden' }}>
          <ToggleRow title="Nepravidelný cyklus" sub="Další menstruace se ukáže jako rozmezí" value={irregular} onChange={setIrregular} />
          <Divider />
          <ToggleRow title="Zobrazovat na Přehledu" sub="Vypnuté = cyklus jen v nastavení karty" value={!hide} onChange={(v) => setHide(!v)} />
        </Card>

        <Card style={{ marginTop: 12, padding: 16 }}>
          <DateField label={hasLogs ? 'Začátek menstruace bez zápisu' : 'Začátek poslední menstruace'} value={lastStart} onChange={setLastStart} />
          <Muted style={{ marginTop: 8, fontSize: 13, lineHeight: 18 }}>Začátky zapsané v ose se upravují přímo v historii cyklů.</Muted>
        </Card>

        <PrimaryButton style={{ marginTop: 24 }} label="Uložit" onPress={save} busy={busy} />
        <SecondaryButton style={{ marginTop: 10 }} danger label="Přestat sledovat cyklus" onPress={stop} />
        <Note style={{ marginTop: 16 }}>Těhotenství, kojení nebo hormonální antikoncepce cyklus mění — odhad pak nemusí sedět.</Note>
      </ScrollView>
    </View>
  );
}

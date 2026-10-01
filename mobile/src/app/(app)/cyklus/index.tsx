import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useCycle } from '@/state/useCycle';
import { useNow } from '@/state/useLoad';
import { CYCLE_DEFAULTS, PAIN_LABEL, cycleLogOf, FLOW_LABEL, type CycleSettings } from '@/domain/cycle';
import { MONTHS_GEN, parseLocalDate, plural, shortDate, toLocalDate, addDays } from '@/domain/dates';
import { Backdrop, BottomFade, Callout, Card, Divider, H1, Loading, Muted, Note, PrimaryButton, Row, SecondaryButton, T, ToggleRow, TopBar, useScreenInsets, useToast } from '@/ui/kit';
import { ActionFab, MeFab } from '@/ui/fabs';
import { DateField } from '@/ui/DateTimeField';
import { CardLabel, CY, CycleRing, DayStrip, Stepper } from '@/ui/cycleViz';
import { C } from '@/ui/theme';
import { IconPlus, TypeGlyph } from '@/ui/icons';

/**
 * Cyklus — samostatná stránka karty. Kruh s počtem dní, fáze cyklu,
 * bolest, souhrn, historie a úprava. Zápisy dne jdou do časové osy jako
 * záznamy typu „Cyklus“ (krvácení, příznaky, posun proti odhadu).
 */
export default function Cyklus() {
  const ins = useScreenInsets();
  const person = usePerson();
  const { settings, info, records, loading } = useCycle();
  const today = toLocalDate(useNow());

  if (loading && !info) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <View style={{ paddingTop: ins.top, paddingHorizontal: 16 }}>
          <TopBar title={person.name} />
          <Loading />
        </View>
      </View>
    );
  }

  if (!settings.enabled || !info) return <Setup initial={settings} />;

  const todayLog = records.find((r) => r.date === today && r.type === 'cycle');
  const todayC = todayLog ? cycleLogOf(todayLog) : null;
  const goLog = (params?: Record<string, string>) => router.push({ pathname: '/cyklus/zapis', params });
  const monthName = (d: string) => parseLocalDate(d).getDate() + '. ' + MONTHS_GEN[parseLocalDate(d).getMonth()];

  const phaseTitle = info.day == null ? 'Zapište první den menstruace' : info.phase === 'zpoždění' ? `${info.day}. den cyklu · zpoždění` : `Dnes · ${info.day}. den cyklu`;
  const phaseSub =
    info.day == null
      ? 'Pak se začne počítat odhad.'
      : info.phase === 'menstruace'
        ? 'Menstruace'
        : info.phase === 'zpoždění'
          ? 'Odhad už uplynul. Až menstruace začne, zapište ji.'
          : `Pravděpodobnost otěhotnění: ${info.chance} · ${info.phase}`;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} backLabel="Zpět na přehled" />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Cyklus</H1>
          <Muted style={{ marginTop: 4 }}>
            {info.nextStart
              ? info.irregular && info.nextRange
                ? `Další menstruace odhadem ${monthName(info.nextRange[0])} – ${monthName(info.nextRange[1])}`
                : `Další menstruace odhadem ${monthName(info.nextStart)}`
              : 'Odhad se spočítá z vašich zápisů'}
          </Muted>
        </View>

        <View style={{ marginTop: 8 }}>
          <CycleRing info={info} />
        </View>

        {/* Fáze cyklu */}
        <Card style={{ padding: 16, borderRadius: 28 }}>
          <CardLabel icon={<TypeGlyph type="cycle" color={C.muted} size={13} />}>Fáze cyklu</CardLabel>
          <T w="semibold" style={{ marginTop: 8, fontSize: 20, lineHeight: 26, letterSpacing: -0.4 }}>{phaseTitle}</T>
          <Muted>{phaseSub}</Muted>
          {info.day != null ? <DayStrip info={info} /> : null}
          <T style={{ marginTop: 10, fontSize: 12, lineHeight: 16, color: C.muted }}>Plodné dny jsou odhad z délky cyklu. Nejsou spolehlivou antikoncepcí.</T>
        </Card>

        {/* Dnešní zápis */}
        <Card white style={{ marginTop: 12, padding: 16, borderRadius: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardLabel>Dnes</CardLabel>
            <Pressable accessibilityRole="button" accessibilityLabel="Zapsat dnešek" onPress={() => goLog(todayLog ? { id: todayLog.id } : undefined)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.chip, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
              <IconPlus size={16} />
            </Pressable>
          </View>
          {todayC ? (
            <Pressable accessibilityRole="button" onPress={() => goLog({ id: todayLog!.id })}>
              <T w="semibold" style={{ marginTop: 6, fontSize: 18, lineHeight: 24 }}>{todayLog!.title}</T>
              <Muted>{[todayC.flow ? 'Krvácení: ' + FLOW_LABEL[todayC.flow].toLowerCase() : null, todayC.pain ? 'bolest ' + PAIN_LABEL[todayC.pain].toLowerCase() : null, todayC.symptoms?.length ? todayC.symptoms.join(', ') : null].filter(Boolean).join(' · ') || 'Bez podrobností'}</Muted>
            </Pressable>
          ) : (
            <>
              <T w="semibold" style={{ marginTop: 6, fontSize: 18, lineHeight: 24 }}>Jak to dnes vypadá?</T>
              <Muted>Krvácení, bolest a příznaky — zapíše se do časové osy.</Muted>
            </>
          )}
          <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
            {!info.inPeriod && !todayC?.start ? (
              <PrimaryButton style={{ flex: 1, minHeight: 48 }} label="Začala menstruace" onPress={() => goLog({ start: '1' })} />
            ) : (
              <PrimaryButton style={{ flex: 1, minHeight: 48 }} label={todayC ? 'Upravit dnešek' : 'Zapsat dnešek'} onPress={() => goLog(todayLog ? { id: todayLog.id } : undefined)} />
            )}
            <SecondaryButton style={{ flex: 1, minHeight: 48 }} label="Příznaky" onPress={() => router.push('/zapis')} />
          </View>
        </Card>

        {/* Bolest */}
        <Card style={{ marginTop: 12, padding: 16, borderRadius: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardLabel icon={<TypeGlyph type="symptom" color={C.muted} size={13} />}>Bolest při menstruaci</CardLabel>
            <Pressable accessibilityRole="button" accessibilityLabel="Zapsat bolest" onPress={() => goLog(todayLog ? { id: todayLog.id } : undefined)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
              <IconPlus size={16} />
            </Pressable>
          </View>
          <T w="semibold" style={{ marginTop: 6, fontSize: 20, lineHeight: 26, letterSpacing: -0.4 }}>
            {info.painAvg == null ? 'Zatím nezapsáno' : 'Obvykle: ' + PAIN_LABEL[Math.round(info.painAvg)].toLowerCase()}
          </T>
          <Muted>{info.painByCycle.length ? `Posledních ${info.painByCycle.length} ${plural(info.painByCycle.length, 'cyklus', 'cykly', 'cyklů')}` : 'Zapisujte bolest u menstruace'}</Muted>
          {info.painByCycle.some((v) => v != null) ? (
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 44 }}>
              {info.painByCycle.map((v, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <View style={{ width: '70%', height: 8 + (v ?? 0) * 10, borderRadius: 6, backgroundColor: v == null ? C.line : v >= 3 ? CY.pink : v === 2 ? CY.pinkSoft : CY.next }} />
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        {/* Souhrn */}
        <Card style={{ marginTop: 12, overflow: 'hidden', borderRadius: 24 }}>
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <CardLabel>Váš cyklus</CardLabel>
          </View>
          <Stat label="Průměrná délka" value={`${info.avgLength} ${plural(info.avgLength, 'den', 'dny', 'dní')}` + (info.minLength !== info.maxLength ? ` (${info.minLength}–${info.maxLength})` : '')} />
          <Divider />
          <Stat label="Menstruace" value={`${info.periodLength} ${plural(info.periodLength, 'den', 'dny', 'dní')}`} />
          <Divider />
          <Stat label="Pravidelnost" value={info.irregular ? 'nepravidelný' : 'pravidelný'} />
        </Card>

        {info.warnings.length ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Callout title="Stojí za to probrat s gynekologem">{info.warnings.join(' ')}</Callout>
            <SecondaryButton label="Moji lékaři" onPress={() => router.push('/lekari')} />
          </View>
        ) : null}

        {/* Historie */}
        {info.history.length ? (
          <Card style={{ marginTop: 12, overflow: 'hidden', borderRadius: 24 }}>
            <View style={{ padding: 16, paddingBottom: 4 }}>
              <CardLabel>Historie cyklů</CardLabel>
            </View>
            {info.history.slice(0, 8).map((h, i) => (
              <View key={h.start}>
                {i ? <Divider /> : null}
                <Row
                  dot={CY.pink}
                  title={shortDate(h.start, today)}
                  sub={[h.length ? `${h.length} ${plural(h.length, 'den', 'dny', 'dní')}` : 'probíhá', h.periodDays ? `menstruace ${h.periodDays} ${plural(h.periodDays, 'den', 'dny', 'dní')}` : null].filter(Boolean).join(' · ')}
                  right={h.shift != null ? <ShiftBadge shift={h.shift} /> : undefined}
                  onPress={h.recordId ? () => goLog({ id: h.recordId! }) : () => router.push('/cyklus/nastaveni')}
                />
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={{ marginTop: 12, overflow: 'hidden', borderRadius: 24 }}>
          <Row title="Upravit cyklus" sub={`Délka ${info.avgLength} dní, menstruace ${info.periodLength} dní${info.irregular ? ', nepravidelný' : ''}`} onPress={() => router.push('/cyklus/nastaveni')} />
        </Card>

        <Note style={{ marginTop: 16 }}>
          Údaje o cyklu jsou jen v tomto telefonu, zašifrované. Nejsou na nouzové kartě a nikam se neposílají.
        </Note>
      </ScrollView>
      <BottomFade />
      <ActionFab label="Zapsat" onPress={() => goLog(todayLog ? { id: todayLog.id } : undefined)} />
      <MeFab label="Zpět na přehled" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <T style={{ fontSize: 14, color: C.muted }}>{label}</T>
      <T w="semibold" style={{ fontSize: 14 }}>{value}</T>
    </View>
  );
}

function ShiftBadge({ shift }: { shift: number }) {
  const label = shift === 0 ? 'přesně' : (shift > 0 ? '+' : '−') + Math.abs(shift) + ' ' + plural(Math.abs(shift), 'den', 'dny', 'dní');
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 11, backgroundColor: shift === 0 ? C.okTint : CY.pinkTint }}>
      <T w="semibold" style={{ fontSize: 12, color: shift === 0 ? C.ok : '#A3265A' }}>{label}</T>
    </View>
  );
}

/** První nastavení — tři údaje a hotovo. */
function Setup({ initial }: { initial: CycleSettings }) {
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const today = toLocalDate(new Date());
  const [known, setKnown] = useState(true);
  const [lastStart, setLastStart] = useState(initial.lastStart ?? addDays(today, -14));
  const [len, setLen] = useState(initial.cycleLength ?? CYCLE_DEFAULTS.cycleLength);
  const [period, setPeriod] = useState(initial.periodLength ?? CYCLE_DEFAULTS.periodLength);
  const [irregular, setIrregular] = useState(!!initial.irregular);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      await data.personData.set(person.id, 'cycle', { ...initial, enabled: true, lastStart: known ? lastStart : undefined, cycleLength: len, periodLength: period, irregular });
      touch();
      toast('Sledování cyklu zapnuto');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Cyklus</H1>
          <Muted style={{ marginTop: 4 }}>Tři údaje stačí. Přesnější to bude s každým zápisem.</Muted>
        </View>
        <Card style={{ marginTop: 16, padding: 16, gap: 16 }}>
          {known ? <DateField label="Kdy začala poslední menstruace" value={lastStart} onChange={setLastStart} /> : null}
          <ToggleRow title="Nevím přesně" sub="Zapíšete ji, až začne" value={!known} onChange={(v) => setKnown(!v)} />
          <Stepper label="Obvyklá délka cyklu" value={len} min={20} max={45} unit={(n) => plural(n, 'den', 'dny', 'dní')} onChange={setLen} />
          <Stepper label="Délka menstruace" value={period} min={2} max={10} unit={(n) => plural(n, 'den', 'dny', 'dní')} onChange={setPeriod} />
          <ToggleRow title="Cyklus je nepravidelný" sub="Odhad se ukáže jako rozmezí" value={irregular} onChange={setIrregular} />
        </Card>
        <PrimaryButton style={{ marginTop: 20 }} label="Začít sledovat" onPress={start} busy={busy} />
        <Note style={{ marginTop: 16 }}>Údaje o cyklu jsou jen v tomto telefonu, zašifrované, a nejsou na nouzové kartě. Sledování jde kdykoli vypnout.</Note>
      </ScrollView>
    </View>
  );
}

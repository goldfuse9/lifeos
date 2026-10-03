import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson } from '@/state/session';
import { useNow } from '@/state/useLoad';
import { useSkolka } from '@/state/useSkolka';
import { akceRecord, answerSurvey, openSurveys } from '@/domain/skolkaFeed';
import { numericDate, toLocalDate } from '@/domain/dates';
import { Card, Chip, Divider, Muted, PrimaryButton, T, useToast } from '@/ui/kit';
import { SkLabel, SkolkaScreen } from '@/ui/SkolkaScreen';
import { C } from '@/ui/theme';
import { IconCheck } from '@/ui/icons';

/**
 * Dotazníky — jen klepnutí, nic se nepíše. „Ano“ u akce zapíše termín do
 * kalendáře a cenu do plateb.
 */
export default function SkolkaDotazniky() {
  const data = useData();
  const person = usePerson();
  const toast = useToast();
  const today = toLocalDate(useNow());
  const { value, saveFeed } = useSkolka();
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!value) return <SkolkaScreen title="Dotazníky" loading />;

  const { feed, akceRec } = value;
  const open = openSurveys(feed);
  const done = (feed.dotazniky ?? []).filter((d) => d.answer).sort((a, b) => (b.answeredAt ?? '').localeCompare(a.answeredAt ?? ''));
  const chosen = open.filter((d) => pick[d.id]);

  const send = async () => {
    setBusy(true);
    try {
      let f = feed;
      const nowIso = new Date().toISOString();
      for (const d of chosen) {
        f = answerSurvey(f, d.id, pick[d.id], today, nowIso);
        const akce = d.akce ? (f.akce ?? []).find((a) => a.id === d.akce) : undefined;
        const rec = akce ? akceRec.get(akce.id) : undefined;
        if (akce && pick[d.id] === d.options[0] && !rec) await data.records.create(person.id, akceRecord(akce, f.demo));
        if (akce && pick[d.id] !== d.options[0] && rec) await data.records.softDelete(rec.id);
        if (d.id === 'alergie' && pick[d.id] !== d.options[0]) router.push('/skolka/sdileni');
      }
      await saveFeed(f);
      setPick({});
      toast(chosen.length === 1 ? 'Odpověď odeslána' : 'Odpovědi odeslány');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SkolkaScreen title="Dotazníky" sub="Stačí klepnout — nic se nepíše" demo={feed.demo}>
      {open.length ? <SkLabel>Čeká na odpověď</SkLabel> : null}
      {open.map((d) => (
        <Card key={d.id} style={{ marginBottom: 12, padding: 16, borderRadius: 24 }}>
          <T w="semibold" style={{ fontSize: 13, color: '#6B22A8' }}>do {numericDate(d.due)}</T>
          <T w="semibold" style={{ marginTop: 4, fontSize: 17, lineHeight: 23 }}>{d.question}</T>
          {d.sub ? <T style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: C.muted }}>{d.sub}</T> : null}
          <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {d.options.map((o) => (
              <Chip key={o} label={o} selected={pick[d.id] === o} onPress={() => setPick((p) => ({ ...p, [d.id]: o }))} />
            ))}
          </View>
          {d.akce ? <T style={{ marginTop: 12, fontSize: 13, lineHeight: 18, color: C.muted }}>Po „{d.options[0]}“ se akce zapíše do kalendáře a cena do plateb.</T> : null}
        </Card>
      ))}
      {open.length ? <PrimaryButton style={{ marginTop: 4 }} label={chosen.length ? (chosen.length === 1 ? 'Odeslat odpověď' : `Odeslat ${chosen.length} odpovědi`) : 'Vyberte odpověď'} disabled={!chosen.length} busy={busy} onPress={send} /> : null}
      {!open.length ? (
        <Card style={{ marginTop: 16, padding: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconCheck size={18} color={C.ok} width={2.4} />
          <T w="semibold" style={{ fontSize: 15, color: '#125742' }}>{done.length ? 'Vše zodpovězeno' : 'Žádný dotazník'}</T>
        </Card>
      ) : null}

      {done.length ? (
        <>
          <SkLabel>Odpovězeno</SkLabel>
          <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
            {done.map((d, i) => (
              <View key={d.id}>
                {i ? <Divider /> : null}
                <View style={{ minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{d.question}</T>
                    <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{d.answer}</T>
                  </View>
                  <IconCheck size={18} color={C.ok} width={2.4} />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}
      <Muted style={{ marginTop: 14, paddingHorizontal: 8, fontSize: 12, lineHeight: 17 }}>Nezodpovězený dotazník svítí v srdci „K vyřešení“.</Muted>
    </SkolkaScreen>
  );
}

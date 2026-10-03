import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson } from '@/state/session';
import { useNow } from '@/state/useLoad';
import { useSkolka } from '@/state/useSkolka';
import { akceRecord, czk, type Akce } from '@/domain/skolkaFeed';
import { MONTHS_NOM, WEEKDAYS_SHORT, parseLocalDate, toLocalDate } from '@/domain/dates';
import { Card, DateBadge, Divider, Muted, T, useToast } from '@/ui/kit';
import { SkLabel, SkolkaScreen } from '@/ui/SkolkaScreen';
import { C } from '@/ui/theme';
import { IconCheck } from '@/ui/icons';

/**
 * Akce školky. Akce se do kalendáře zapisují jako termíny (kalendář je jen
 * pro plán) — samy u akcí bez přihlášky, po „Ano“ v dotazníku u ostatních,
 * nebo tlačítkem.
 */
export default function SkolkaAkce() {
  const data = useData();
  const person = usePerson();
  const toast = useToast();
  const today = toLocalDate(useNow());
  const { value } = useSkolka();
  if (!value) return <SkolkaScreen title="Akce" loading />;

  const { feed, akceRec } = value;
  const list = (feed.akce ?? []).filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = new Map<string, Akce[]>();
  for (const a of list) {
    const k = a.date.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), a]);
  }

  const toCalendar = async (a: Akce) => {
    await data.records.create(person.id, akceRecord(a, feed.demo));
    toast('Zapsáno do kalendáře');
  };

  return (
    <SkolkaScreen title="Akce" sub="Termíny se zapisují do kalendáře a „Blíží se“" demo={feed.demo}>
      {list.length ? (
        [...byMonth.entries()].map(([k, items]) => (
          <View key={k}>
            <SkLabel>{MONTHS_NOM[Number(k.slice(5)) - 1]}</SkLabel>
            <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
              {items.map((a, i) => {
                const rec = akceRec.get(a.id);
                const dot = a.dotaznik ? (feed.dotazniky ?? []).find((d) => d.id === a.dotaznik) : undefined;
                const paid = (feed.platby ?? []).find((p) => p.akce === a.id);
                const wd = WEEKDAYS_SHORT[parseLocalDate(a.date).getDay()].toLowerCase();
                return (
                  <View key={a.id}>
                    {i ? <Divider /> : null}
                    <View style={{ padding: 14, flexDirection: 'row', gap: 12 }}>
                      <DateBadge day={Number(a.date.slice(8))} mon={wd} tint={a.info ? C.chip : dot && !dot.answer ? '#F3E8FC' : C.orangeTint} fg={a.info ? C.muted : dot && !dot.answer ? '#6B22A8' : C.orangeInk} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{a.title}</T>
                        <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{[a.time?.replace(/^0/, ''), a.place, a.price ? czk(a.price) : null, a.note].filter(Boolean).join(' · ')}</T>
                        {a.info ? null : dot && !dot.answer ? (
                          <Btn dark label="Odpovědět v dotazníku" onPress={() => router.push('/skolka/dotazniky')} />
                        ) : dot && dot.answer !== dot.options[0] ? (
                          <Ok label={dot.answer!} muted />
                        ) : rec ? (
                          <Ok label={'V kalendáři' + (paid?.paidAt ? ' · zaplaceno' : paid ? ' · čeká platba' : '')} />
                        ) : (
                          <Btn label="Přidat do kalendáře" onPress={() => toCalendar(a)} />
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        ))
      ) : (
        <Card style={{ marginTop: 16, padding: 16, borderRadius: 22 }}>
          <T style={{ fontSize: 14, lineHeight: 20, color: C.muted }}>Žádné akce v plánu.</T>
        </Card>
      )}
      <Muted style={{ marginTop: 14, paddingHorizontal: 8, fontSize: 12, lineHeight: 17 }}>Termín v kalendáři se připomene podle nastavení upozornění. U placených akcí vznikne platba.</Muted>
    </SkolkaScreen>
  );
}

function Btn({ label, onPress, dark }: { label: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ marginTop: 8, alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: dark ? C.ink : C.white, borderWidth: dark ? 0 : 1, borderColor: C.line, opacity: pressed ? 0.8 : 1 })}>
      <T w="semibold" style={{ fontSize: 14, color: dark ? C.white : C.ink }}>{label}</T>
    </Pressable>
  );
}

function Ok({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {muted ? null : <IconCheck size={15} color={C.ok} width={2.4} />}
      <T w="semibold" style={{ fontSize: 13, color: muted ? C.muted : C.ok }}>{label}</T>
    </View>
  );
}

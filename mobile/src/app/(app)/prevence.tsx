import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson } from '@/state/session';
import { useLoad, useNow } from '@/state/useLoad';
import { applicable, ageOnDate, preventionOverview, type PrevState, type PrevStatus } from '@/domain/prevention';
import { addDays, numericDate, toLocalDate } from '@/domain/dates';
import { Backdrop, BottomFade, Card, Divider, H1, Loading, Muted, Note, T, TopBar, useScreenInsets } from '@/ui/kit';
import { C } from '@/ui/theme';

/**
 * Prevence — preventivní prohlídky a screeningy, na které má karta nárok
 * podle věku a pohlaví. Naplánování = termín v kalendáři (s připomínkou),
 * provedení = návštěva v ose.
 */

const STATE: Record<PrevState, { label: string; fg: string; bg: string; dot: string }> = {
  now: { label: 'Nárok teď', fg: '#7A4300', bg: '#FFF1E0', dot: '#F7931E' },
  soon: { label: 'Brzy', fg: '#7A4300', bg: '#FFF1E0', dot: '#F7931E' },
  planned: { label: 'Naplánováno', fg: '#27407A', bg: '#E8EFFD', dot: '#3B6FE0' },
  ok: { label: 'V pořádku', fg: '#17694F', bg: '#E0F5EC', dot: '#2E9E6B' },
  ask: { label: 'U lékaře', fg: '#514F57', bg: '#F1F0EE', dot: '#CFCDD2' },
};

export default function Prevence() {
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const today = toLocalDate(useNow());
  const [openRow, setOpenRow] = useState<string | null>(null);

  const { value } = useLoad(async () => {
    const [recs, personal] = await Promise.all([data.records.query({ personId: person.id, types: ['visit', 'event', 'result'] }), data.personData.get(person.id, 'personal')]);
    return { recs, personal };
  }, [person.id]);

  if (!value) {
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

  const defs = applicable(person.birthDate, value.personal, today);
  const list = preventionOverview(defs, value.recs, today);
  const now = list.filter((s) => s.state === 'now');
  const age = person.birthDate ? ageOnDate(person.birthDate, today) : null;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} backLabel="Zpět na přehled" />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Prevence</H1>
          <Muted style={{ marginTop: 4 }}>Prohlídky a screeningy hrazené pojišťovnou{age != null ? ` · ${age} ${age === 1 ? 'rok' : age < 5 && age > 1 ? 'roky' : 'let'}` : ''}</Muted>
        </View>

        <View accessibilityRole="text" style={{ marginTop: 16, padding: 14, borderRadius: 20, backgroundColor: now.length ? 'rgba(247,147,30,0.10)' : 'rgba(46,158,107,0.09)', borderWidth: 1, borderColor: now.length ? 'rgba(247,147,30,0.28)' : 'rgba(46,158,107,0.22)' }}>
          <T w="semibold" style={{ fontSize: 14, color: now.length ? C.orangeInk : '#125742' }}>{now.length ? 'Máte nárok — stačí se objednat' : 'Teď nic nečeká'}</T>
          {now.length ? <T style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: C.orangeInk }}>{now.map((s) => s.def.name).join(', ')}</T> : null}
        </View>
        {!person.birthDate || !value.personal.sex ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/nastaveni/osobni')} style={{ marginTop: 8, padding: 12, borderRadius: 18, backgroundColor: 'rgba(59,111,224,0.07)', borderWidth: 1, borderColor: 'rgba(59,111,224,0.16)' }}>
            <T style={{ fontSize: 13, lineHeight: 18, color: '#27407A' }}>Doplňte {[!person.birthDate ? 'datum narození' : null, !value.personal.sex ? 'pohlaví' : null].filter(Boolean).join(' a ')} v Osobních údajích — ukážu i screeningy podle věku. <T w="semibold" style={{ fontSize: 13, color: '#27407A', textDecorationLine: 'underline' }}>Doplnit</T></T>
          </Pressable>
        ) : null}

        <Card style={{ marginTop: 16, overflow: 'hidden', borderRadius: 22 }}>
          {list.map((s, i) => {
            const st = STATE[s.state];
            const expanded = openRow === s.def.key;
            return (
              <View key={s.def.key}>
                {i ? <Divider /> : null}
                <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpenRow(expanded ? null : s.def.key)} style={({ pressed }) => ({ minHeight: 64, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pressed ? 'rgba(255,255,255,0.6)' : 'transparent' })}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: st.dot }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T w="semibold" numberOfLines={2} style={{ fontSize: 15, lineHeight: 20 }}>{s.def.name}</T>
                    <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{s.hint}</T>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: st.bg }}>
                    <T w="semibold" style={{ fontSize: 11, color: st.fg }}>{st.label}</T>
                  </View>
                </Pressable>
                {expanded ? <Detail s={s} today={today} /> : null}
              </View>
            );
          })}
        </Card>

        <Note style={{ marginTop: 16 }}>Podle pravidel zdravotních pojišťoven pro rok 2026. Přesný nárok a termín potvrdí lékař. Naplánovaná prohlídka se ukáže v kalendáři a připomene se podle nastavení upozornění.</Note>
      </ScrollView>
      <BottomFade />
    </View>
  );
}

function Detail({ s, today }: { s: PrevStatus; today: string }) {
  const suggested = s.nextFrom && s.nextFrom > today ? s.nextFrom : addDays(today, 7);
  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingLeft: 32, gap: 6 }}>
      <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>Kde: {s.def.who}</T>
      <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>Co: {s.def.what}</T>
      <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>Jak často: {s.def.often}</T>
      {s.last ? (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/zaznam/${s.last!.id}`)} hitSlop={6}>
          <T style={{ fontSize: 13, textDecorationLine: 'underline' }}>Poslední: {numericDate(s.last.date)}</T>
        </Pressable>
      ) : null}
      <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {s.planned ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/zaznam/${s.planned!.id}`)} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.ink, justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
            <T w="semibold" style={{ fontSize: 14, color: C.white }}>Otevřít termín</T>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/zaznam/upravit', params: { type: 'visit', date: suggested, prevence: s.def.key } })} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.ink, justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
            <T w="semibold" style={{ fontSize: 14, color: C.white }}>Naplánovat</T>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/zaznam/upravit', params: { type: 'visit', prevence: s.def.key } })} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
          <T w="semibold" style={{ fontSize: 14 }}>Byl/a jsem — zapsat</T>
        </Pressable>
      </View>
    </View>
  );
}

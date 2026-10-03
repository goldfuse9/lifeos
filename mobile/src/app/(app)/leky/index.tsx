import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useNow } from '@/state/useLoad';
import { useMeds } from '@/state/useMeds';
import { dosesFor, medSchedule, medTitle, toggleDose } from '@/domain/meds';
import { toLocalDate, toLocalTime } from '@/domain/dates';
import { Backdrop, BottomFade, Card, Divider, H1, Loading, Muted, Note, Row, T, TopBar, haptic, useScreenInsets } from '@/ui/kit';
import { ActionFab } from '@/ui/fabs';
import { C } from '@/ui/theme';
import { IconCheck, TypeGlyph } from '@/ui/icons';

/**
 * Léky — dnešní dávky k odškrtnutí, co beru, co jsem dřív bral.
 * Odškrtnutí zůstává v telefonu; do osy jde jen změna léku.
 */
export default function Leky() {
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const { meds, log, loading } = useMeds();
  const now = useNow();
  const today = toLocalDate(now);
  const nowT = toLocalTime(now);

  if (loading) {
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

  const doses = dosesFor(meds, log, today);
  const active = meds.filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  const past = meds.filter((m) => !m.active);
  const left = doses.filter((d) => !d.taken).length;

  const toggle = async (key: string) => {
    haptic();
    await data.personData.set(person.id, 'medlog', toggleDose(log, today, key));
    touch();
  };

  const edit = (id?: string) => router.push({ pathname: '/leky/upravit', params: id ? { id } : {} });

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} backLabel="Zpět na přehled" />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Léky</H1>
          <Muted style={{ marginTop: 4 }}>{doses.length ? (left ? `Dnes zbývá ${left} z ${doses.length}` : 'Dnes je vše vzato') : active.length ? 'Jen podle potřeby' : 'Co pravidelně berete'}</Muted>
        </View>

        {doses.length ? (
          <Card white style={{ marginTop: 16, overflow: 'hidden', borderRadius: 24 }}>
            {doses.map((d, i) => {
              const late = !d.taken && d.time < nowT;
              return (
                <View key={d.key}>
                  {i ? <Divider /> : null}
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: d.taken }}
                    accessibilityLabel={`${d.time} ${medTitle(d.med)}`}
                    onPress={() => toggle(d.key)}
                    style={({ pressed }) => ({ minHeight: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}
                  >
                    <T w="semibold" style={{ width: 44, fontSize: 14, fontVariant: ['tabular-nums'], color: late ? C.orangeInk : C.muted }}>{d.time.replace(/^0/, '')}</T>
                    <View style={{ flex: 1 }}>
                      <T w="semibold" numberOfLines={1} style={{ fontSize: 15, color: d.taken ? C.muted : C.ink, textDecorationLine: d.taken ? 'line-through' : 'none' }}>{medTitle(d.med)}</T>
                    </View>
                    <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: d.taken ? C.ok : late ? C.orange : '#CFCDD2', backgroundColor: d.taken ? C.ok : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {d.taken ? <IconCheck size={16} color={C.white} width={2.4} /> : null}
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        ) : null}

        {active.length ? (
          <>
            <T w="semibold" style={{ marginTop: 22, paddingLeft: 4, fontSize: 12, color: C.muted }}>Beru</T>
            <Card style={{ marginTop: 8, overflow: 'hidden', borderRadius: 24 }}>
              {active.map((m, i) => (
                <View key={m.id}>
                  {i ? <Divider /> : null}
                  <Row title={medTitle(m)} sub={medSchedule(m) + (m.remind && m.times.length ? ' · připomínám' : '')} dot="#D9920F" onPress={() => edit(m.id)} />
                </View>
              ))}
            </Card>
          </>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => edit()} style={{ marginTop: 16, paddingVertical: 28, paddingHorizontal: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DCDAD6', borderRadius: 24, alignItems: 'center', gap: 8 }}>
            <TypeGlyph type="med" color="#D9920F" size={22} />
            <Muted style={{ textAlign: 'center' }}>Zatím žádné léky. Přidejte, co pravidelně berete — ukáže se to i na nouzové kartě.</Muted>
          </Pressable>
        )}

        {past.length ? (
          <>
            <T w="semibold" style={{ marginTop: 22, paddingLeft: 4, fontSize: 12, color: C.muted }}>Dříve</T>
            <Card style={{ marginTop: 8, overflow: 'hidden', borderRadius: 24 }}>
              {past.map((m, i) => (
                <View key={m.id}>
                  {i ? <Divider /> : null}
                  <Row title={medTitle(m)} sub={m.until ? 'do ' + m.until.split('-').reverse().map(Number).join('. ') : 'nebere'} onPress={() => edit(m.id)} />
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <Note style={{ marginTop: 16 }}>Léky, které berete, se ukazují na nouzové kartě. Do časové osy se zapíše jen začátek, změna a konec.</Note>
      </ScrollView>
      <BottomFade />
      <ActionFab label="Přidat lék" onPress={() => edit()} />
    </View>
  );
}

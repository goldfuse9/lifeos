import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData, usePerson } from '@/state/session';
import { useLoad, useNow } from '@/state/useLoad';
import { CAL_WEEKDAYS, MONTHS_GEN, MONTHS_NOM, WEEKDAYS_SHORT, isValidLocalDate, monthGrid, parseLocalDate, plural, toLocalDate } from '@/domain/dates';
import { RECORD_TYPES } from '@/domain/recordTypes';
import { recordSubtitle } from '@/domain/timeline';
import { Backdrop, Card, H1, Muted, PillButton, PrimaryButton, T, TopBar, useScreenInsets } from '@/ui/kit';
import { TypeDot } from '@/ui/records';
import { C } from '@/ui/theme';
import { IconBack, IconChevron } from '@/ui/icons';

/**
 * Kalendář — mřížka z Přehledu (cal), ale nad stejnými daty jako osa.
 * Den se vybere klepnutím, pod mřížkou jsou jeho záznamy a tlačítko
 * „Přidat na tento den“.
 */
export default function Kalendar() {
  const params = useLocalSearchParams<{ date?: string }>();
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const now = useNow();
  const today = toLocalDate(now);
  const start = params.date && isValidLocalDate(params.date) ? params.date : today;
  const [sel, setSel] = useState(start);
  const [ym, setYm] = useState(() => {
    const d = parseLocalDate(start);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const grid = monthGrid(ym.y, ym.m);
  const { value: dots } = useLoad(() => data.records.datesWithRecords(person.id, grid[0], grid[41]), [person.id, grid[0]]);
  const { value: dayRecs } = useLoad(() => data.records.query({ personId: person.id, from: sel, to: sel, order: 'asc' }), [person.id, sel]);

  const shift = (n: number) => setYm(({ y, m }) => {
    const d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const goToday = () => {
    const d = parseLocalDate(today);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    setSel(today);
  };

  const selD = parseLocalDate(sel);
  const recs = dayRecs ?? [];

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} />
        <View style={{ marginTop: 18, paddingLeft: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <H1>{MONTHS_NOM[ym.m]}</H1>
            <Muted style={{ marginTop: 4 }}>{ym.y}</Muted>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PillButton accessibilityRole="button" accessibilityLabel="Předchozí měsíc" onPress={() => shift(-1)}>
              <IconBack size={18} color={C.ink} />
            </PillButton>
            <PillButton accessibilityRole="button" accessibilityLabel="Další měsíc" onPress={() => shift(1)}>
              <IconChevron size={18} color={C.ink} />
            </PillButton>
          </View>
        </View>

        <Card style={{ marginTop: 16, padding: 10, borderRadius: 28 }}>
          <View style={{ flexDirection: 'row' }}>
            {CAL_WEEKDAYS.map((w) => (
              <T key={w} w="semibold" style={{ flex: 1, textAlign: 'center', fontSize: 11, lineHeight: 24, letterSpacing: 0.6, color: C.muted, textTransform: 'uppercase' }}>{w}</T>
            ))}
          </View>
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {grid.slice(row * 7, row * 7 + 7).map((d) => {
                const dt = parseLocalDate(d);
                const inMonth = dt.getMonth() === ym.m;
                const isToday = d === today;
                const isSel = d === sel;
                const n = dots?.get(d) ?? 0;
                const weekend = dt.getDay() === 0 || dt.getDay() === 6;
                // Dny vedlejšího měsíce jsou jen dokreslení mřížky (jako na desce) — klepnutí přepne měsíc.
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={(isToday ? 'Dnes, ' : '') + WEEKDAYS_SHORT[dt.getDay()] + ' ' + dt.getDate() + '. ' + MONTHS_GEN[dt.getMonth()] + (n ? ', ' + n + ' ' + plural(n, 'záznam', 'záznamy', 'záznamů') : '')}
                    onPress={() => {
                      setSel(d);
                      if (!inMonth) setYm({ y: dt.getFullYear(), m: dt.getMonth() });
                    }}
                    style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? C.ink : isSel ? C.orangeTint : 'transparent', borderWidth: 1, borderColor: isSel && !isToday ? C.orangeLine : 'transparent' }}>
                      <T w={isToday || isSel ? 'semibold' : 'regular'} style={{ fontSize: 15, fontVariant: ['tabular-nums'], color: !inMonth ? C.faint : isToday ? C.white : weekend ? C.muted : C.ink }}>{dt.getDate()}</T>
                      <View style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: n && inMonth ? (isToday ? C.white : C.orange) : 'transparent' }} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>

        <View style={{ marginTop: 20, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T w="semibold" style={{ fontSize: 16 }}>{WEEKDAYS_SHORT[selD.getDay()] + ' ' + selD.getDate() + '. ' + MONTHS_GEN[selD.getMonth()]}</T>
          {sel !== today ? (
            <Pressable accessibilityRole="button" onPress={goToday} hitSlop={8}>
              <T w="semibold" style={{ fontSize: 14, color: C.muted }}>Dnes</T>
            </Pressable>
          ) : null}
        </View>

        <View style={{ marginTop: 8, gap: 8 }}>
          {recs.length ? (
            recs.map((r) => (
              <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push(`/zaznam/${r.id}`)} style={({ pressed }) => ({ minHeight: 64, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 20, backgroundColor: pressed ? '#FFFFFF' : 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 12 })}>
                <T w="semibold" style={{ width: 44, textAlign: 'center', fontSize: 13, color: C.ink2, fontVariant: ['tabular-nums'] }}>{r.time ?? 'celý\nden'}</T>
                <TypeDot r={r} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T w="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{r.title}</T>
                  <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{[RECORD_TYPES[r.type].label, recordSubtitle(r)].filter(Boolean).join(' · ')}</T>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={{ paddingVertical: 20, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DCDAD6', alignItems: 'center' }}>
              <Muted>Nic naplánováno</Muted>
            </View>
          )}
        </View>

        <PrimaryButton
          style={{ marginTop: 16 }}
          label={sel >= today ? 'Naplánovat na tento den' : 'Zapsat k tomuto dni'}
          onPress={() => router.push({ pathname: '/zaznam/upravit', params: { date: sel, type: sel >= today ? 'event' : 'note' } })}
        />
      </ScrollView>
    </View>
  );
}

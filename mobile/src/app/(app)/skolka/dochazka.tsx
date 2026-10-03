import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useNow } from '@/state/useLoad';
import { useSkolka } from '@/state/useSkolka';
import { denStav, monthStats, type DenStav } from '@/domain/skolkaFeed';
import { CAL_WEEKDAYS, MONTHS_NOM, monthGrid, numericDate, toLocalDate } from '@/domain/dates';
import { Card, Muted, PrimaryButton, T } from '@/ui/kit';
import { SkLabel, SkolkaScreen } from '@/ui/SkolkaScreen';
import { C } from '@/ui/theme';
import { IconBack, IconChevron } from '@/ui/icons';

/**
 * Docházka po měsících. Omluvené dny jsou skutečné (z omluvenek v ose),
 * dny ve školce zatím přicházejí jen z ukázky — skutečně je bude
 * zapisovat školka.
 */
const ST: Record<DenStav, { bg: string; fg: string; w: 'semibold' | 'regular' }> = {
  in: { bg: C.okTint, fg: C.ok, w: 'semibold' },
  omluven: { bg: '#F3E8FC', fg: '#6B22A8', w: 'semibold' },
  volno: { bg: 'transparent', fg: C.faint, w: 'regular' },
  budouci: { bg: 'transparent', fg: C.ink2, w: 'regular' },
  nic: { bg: 'transparent', fg: C.ink2, w: 'regular' },
};

export default function SkolkaDochazka() {
  const now = useNow();
  const today = toLocalDate(now);
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const { value } = useSkolka();
  if (!value) return <SkolkaScreen title="Docházka" loading />;

  const { feed, school } = value;
  const omluvRecs = school.filter((r) => r.metadata.skolka === 'omluvenka');
  const omluveno = new Set(omluvRecs.map((r) => r.date));
  const pritomen = new Set(feed.pritomen ?? []);
  const grid = monthGrid(ym.y, ym.m);
  const stats = monthStats(ym.y, ym.m, today, pritomen, omluveno);
  const upcoming = omluvRecs.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const prichod = feed.prichod?.date === today && !omluveno.has(today) ? feed.prichod.time : null;
  const shift = (n: number) => setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  return (
    <SkolkaScreen title="Docházka" sub={prichod ? `Dnes ve školce od ${prichod.replace(/^0/, '')}` : omluveno.has(today) ? 'Dnes omluveno' : undefined} demo={feed.demo}>
      <View style={{ marginTop: 16, flexDirection: 'row', gap: 10 }}>
        <Stat n={stats.inn} label={stats.inn === 1 ? 'den ve školce' : 'dní ve školce'} color={C.ok} />
        <Stat n={stats.om} label={stats.om === 1 ? "den omluven" : "dní omluveno"} color="#6B22A8" />
      </View>

      <View style={{ marginTop: 22, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T w="semibold" style={{ marginLeft: 8, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: C.muted }}>{MONTHS_NOM[ym.m]} {ym.y}</T>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Předchozí měsíc" onPress={() => shift(-1)} hitSlop={6} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' }}><IconBack size={16} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Další měsíc" onPress={() => shift(1)} hitSlop={6} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' }}><IconChevron size={16} /></Pressable>
        </View>
      </View>
      <Card style={{ padding: 12, borderRadius: 22 }}>
        <View style={{ flexDirection: 'row' }}>
          {CAL_WEEKDAYS.map((w) => (
            <T key={w} w="semibold" style={{ flex: 1, textAlign: 'center', fontSize: 11, color: C.muted, textTransform: 'uppercase' }}>{w}</T>
          ))}
        </View>
        <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap' }}>
          {grid.map((d) => {
            const inMonth = Number(d.slice(5, 7)) - 1 === ym.m;
            const s = ST[denStav(d, today, pritomen, omluveno)];
            return (
              <View key={d} style={{ width: '14.2857%', padding: 2 }}>
                {inMonth ? (
                  <View accessibilityLabel={numericDate(d)} style={{ height: 38, borderRadius: 11, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center', borderWidth: d === today ? 2 : 0, borderColor: C.ink }}>
                    <T w={s.w} style={{ fontSize: 14, color: s.fg, fontVariant: ['tabular-nums'] }}>{Number(d.slice(8))}</T>
                  </View>
                ) : (
                  <View style={{ height: 38 }} />
                )}
              </View>
            );
          })}
        </View>
        <View style={{ marginTop: 10, flexDirection: 'row', gap: 14, flexWrap: 'wrap', paddingHorizontal: 4 }}>
          <Legend bg={C.okTint} label="ve školce" />
          <Legend bg="#F3E8FC" label="omluveno" />
          <Legend ring label="dnes" />
        </View>
      </Card>

      {upcoming.length ? (
        <>
          <SkLabel>Omluveno</SkLabel>
          <Card style={{ padding: 14, borderRadius: 22, gap: 6 }}>
            {upcoming.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.purple }} />
                <T w="semibold" style={{ fontSize: 15 }}>{numericDate(r.date)}</T>
                <T style={{ fontSize: 13, color: C.muted }}>{r.description}</T>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <PrimaryButton style={{ marginTop: 16 }} label="Omluvit" onPress={() => router.push('/skolka/omluvit')} />
      <Muted style={{ marginTop: 12, paddingHorizontal: 8, fontSize: 12, lineHeight: 17 }}>Omluvenka se zapíše do docházky i do osy a odejde školce jako SMS.</Muted>
    </SkolkaScreen>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <Card style={{ flex: 1, padding: 14, borderRadius: 22 }}>
      <T w="semibold" style={{ fontSize: 28, lineHeight: 34, color }}>{n}</T>
      <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{label}</T>
    </Card>
  );
}

function Legend({ bg, ring, label }: { bg?: string; ring?: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: bg ?? 'transparent', borderWidth: ring ? 2 : 0, borderColor: C.ink }} />
      <T style={{ fontSize: 13, color: C.ink2 }}>{label}</T>
    </View>
  );
}

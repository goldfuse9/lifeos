import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson } from '@/state/session';
import { useLoad, useNow } from '@/state/useLoad';
import { vaxNotices, vaxOverview, type VaxState, type VaxStatus } from '@/domain/vaccineCatalog';
import { numericDate, toLocalDate } from '@/domain/dates';
import { Backdrop, BottomFade, Card, Chip, Divider, H1, Loading, Muted, Note, T, TopBar, useScreenInsets } from '@/ui/kit';
import { ActionFab, FilterFab } from '@/ui/fabs';
import { C } from '@/ui/theme';
import { IconCamera, IconChevronDown, TypeGlyph } from '@/ui/icons';

/**
 * Očkování — jako panel „Já“: nahoře upozornění (po termínu, chybí,
 * sezóna chřipky a klíšťat), pod ním 1. Povinná a 2. Nepovinná, každé
 * očkování jde rozkliknout. Data jsou záznamy v ose (typ Očkování).
 */

type Filter = 'all' | 'todo' | 'given' | 'none';
const FILTERS: [Filter, string][] = [
  ['all', 'Vše'],
  ['todo', 'K řešení'],
  ['given', 'Podaná'],
  ['none', 'Bez záznamu'],
];

const STATE: Record<VaxState, { label: string; fg: string; bg: string; dot: string } | null> = {
  due: { label: 'Po termínu', fg: '#B42318', bg: '#FDE7E5', dot: '#D92D20' },
  missing: { label: 'Chybí', fg: '#7A4300', bg: '#FFF1E0', dot: '#F7931E' },
  soon: { label: 'Brzy', fg: '#7A4300', bg: '#FFF1E0', dot: '#F7931E' },
  ok: { label: 'V pořádku', fg: '#17694F', bg: '#E0F5EC', dot: '#2E9E6B' },
  notyet: null,
  unknown: null,
};

const ageYears = (birth: string | null, today: string) => (birth ? Number(today.slice(0, 4)) - Number(birth.slice(0, 4)) - (today.slice(5) < birth.slice(5) ? 1 : 0) : null);

export default function Ockovani() {
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const today = toLocalDate(useNow());
  const [open, setOpen] = useState<Record<string, boolean>>({ povinne: true, doporucene: true });
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const { value } = useLoad(async () => {
    const [recs, docs] = await Promise.all([data.records.query({ personId: person.id, types: ['vaccine'] }), data.personData.get(person.id, 'docs')]);
    const card = docs.vaxRecordId ? await data.records.get(docs.vaxRecordId) : null;
    const photos = card ? (await data.attachments.forRecord(card.id)).length : 0;
    return { recs, card, photos };
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

  const age = ageYears(person.birthDate, today);
  const all = vaxOverview(value.recs, person.birthDate, today);
  const notices = vaxNotices(all, today, age != null && age < 7);
  const pass = (s: VaxStatus) =>
    filter === 'all' ? true : filter === 'todo' ? s.state === 'due' || s.state === 'missing' || s.state === 'soon' : filter === 'given' ? s.doses.length > 0 : s.doses.length === 0;
  const groups: { key: 'povinne' | 'doporucene'; title: string; dot: string; list: VaxStatus[] }[] = [
    { key: 'povinne', title: '1. Povinná', dot: '#D92D20', list: all.filter((s) => s.group === 'povinne' && pass(s)) },
    { key: 'doporucene', title: '2. Nepovinná', dot: '#2E9E6B', list: all.filter((s) => s.group === 'doporucene' && pass(s)) },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} backLabel="Zpět na přehled" />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Očkování</H1>
          <Muted style={{ marginTop: 4 }}>{age != null ? `${person.name} · ${age} ${age === 1 ? 'rok' : age < 5 ? 'roky' : 'let'}` : 'Doplňte datum narození — pohlídám povinná očkování podle věku'}</Muted>
        </View>

        {/* Informační okénko */}
        {notices.length ? (
          <View style={{ marginTop: 16, gap: 8 }}>
            {notices.map((n) => (
              <View key={n.title} accessibilityRole="text" style={{ padding: 14, borderRadius: 20, backgroundColor: n.tone === 'warn' ? 'rgba(247,147,30,0.10)' : 'rgba(59,111,224,0.07)', borderWidth: 1, borderColor: n.tone === 'warn' ? 'rgba(247,147,30,0.28)' : 'rgba(59,111,224,0.16)' }}>
                <T w="semibold" style={{ fontSize: 14, color: n.tone === 'warn' ? C.orangeInk : '#27407A' }}>{n.title}</T>
                <T style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: n.tone === 'warn' ? C.orangeInk : '#27407A' }}>{n.text}</T>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ marginTop: 16, padding: 14, borderRadius: 20, backgroundColor: 'rgba(46,158,107,0.09)', borderWidth: 1, borderColor: 'rgba(46,158,107,0.22)' }}>
            <T w="semibold" style={{ fontSize: 14, color: '#125742' }}>Nic nečeká na přeočkování</T>
          </View>
        )}

        {/* Načíst z průkazu */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/ockovani/sken')}
          style={({ pressed }) => ({ marginTop: 12, minHeight: 60, padding: 12, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#E0F5EC', alignItems: 'center', justifyContent: 'center' }}>
            <IconCamera size={18} color="#17694F" />
          </View>
          <View style={{ flex: 1 }}>
            <T w="semibold" style={{ fontSize: 15 }}>Načíst z očkovacího průkazu</T>
            <T style={{ fontSize: 13, color: C.muted }}>{value.photos ? `Vyfoceno ${value.photos} ${value.photos === 1 ? 'stránka' : value.photos < 5 ? 'stránky' : 'stránek'} · přidat další` : 'Vyfoťte stránku, očkování se doplní'}</T>
          </View>
        </Pressable>
        {value.card && value.photos ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push(`/zaznam/${value.card!.id}`)} style={{ alignSelf: 'flex-start', marginTop: 8, marginLeft: 4 }}>
            <T style={{ fontSize: 13, color: C.muted, textDecorationLine: 'underline' }}>Otevřít fotky průkazu</T>
          </Pressable>
        ) : null}

        {filter !== 'all' ? (
          <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
            <T style={{ fontSize: 13, color: C.muted }}>Filtr:</T>
            <Chip label={FILTERS.find((f) => f[0] === filter)![1] + ' ✕'} selected onPress={() => setFilter('all')} />
          </View>
        ) : null}

        {groups.map((g) => (
          <View key={g.key} style={{ marginTop: 20 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: !!open[g.key] }}
              onPress={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
              style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 8 }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: g.dot }} />
              <T w="semibold" style={{ flex: 1, fontSize: 13, color: C.muted }}>{g.title + (g.list.length ? ` · ${g.list.length}` : '')}</T>
              <View style={{ transform: [{ rotate: open[g.key] ? '180deg' : '0deg' }] }}>
                <IconChevronDown size={16} color={C.muted} />
              </View>
            </Pressable>
            {open[g.key] ? (
              g.list.length ? (
                <Card style={{ overflow: 'hidden', borderRadius: 22 }}>
                  {g.list.map((s, i) => {
                    const id = s.def?.key ?? s.name;
                    const st = STATE[s.state];
                    const expanded = openRow === id;
                    return (
                      <View key={id}>
                        {i ? <Divider /> : null}
                        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpenRow(expanded ? null : id)} style={({ pressed }) => ({ minHeight: 64, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pressed ? 'rgba(255,255,255,0.6)' : 'transparent' })}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: st?.dot ?? '#CFCDD2' }} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <T w="semibold" numberOfLines={2} style={{ fontSize: 15, lineHeight: 20 }}>{s.name}</T>
                            <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>
                              {s.last ? 'Podáno ' + numericDate(s.last.date) + (s.nextDue ? ' · přeočkovat do ' + numericDate(s.nextDue) : '') : s.hint || 'Bez záznamu'}
                            </T>
                          </View>
                          {st ? (
                            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: st.bg }}>
                              <T w="semibold" style={{ fontSize: 11, color: st.fg }}>{st.label}</T>
                            </View>
                          ) : null}
                        </Pressable>
                        {expanded ? <Detail s={s} /> : null}
                      </View>
                    );
                  })}
                </Card>
              ) : (
                <Muted style={{ paddingHorizontal: 8, fontSize: 13 }}>{filter === 'all' ? 'Zatím nic. Zapište očkování nebo ho načtěte z průkazu.' : 'Nic neodpovídá filtru.'}</Muted>
              )
            ) : null}
          </View>
        ))}

        <Note style={{ marginTop: 16 }}>Podle očkovacího kalendáře ČR (vyhláška č. 537/2006 Sb.). Povinná očkování dětí jsou podmínkou přijetí do mateřské školy. Termíny jsou orientační — rozhoduje lékař.</Note>
      </ScrollView>

      {filterOpen ? (
        <>
          <Pressable accessibilityLabel="Zavřít filtr" onPress={() => setFilterOpen(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(245,245,244,0.5)' }} />
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 104 + Math.max(0, ins.bottom - 128), padding: 16, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: C.line, boxShadow: '0px 20px 48px rgba(40,40,40,0.12)' }}>
            <T w="semibold" style={{ fontSize: 13, color: C.muted }}>Zobrazit</T>
            <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {FILTERS.map(([k, l]) => (
                <Chip
                  key={k}
                  label={l}
                  selected={filter === k}
                  onPress={() => {
                    setFilter(k);
                    setFilterOpen(false);
                  }}
                />
              ))}
            </View>
          </View>
        </>
      ) : null}

      <BottomFade />
      <ActionFab label="Zapsat" a11y="Zapsat očkování" onPress={() => router.push('/ockovani/upravit')} before={<FilterFab label="Filtr očkování" active={filter !== 'all'} onPress={() => setFilterOpen((o) => !o)} />} />
    </View>
  );
}

function Detail({ s }: { s: VaxStatus }) {
  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingLeft: 32, gap: 8 }}>
      {s.def ? (
        <>
          <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>Proti: {s.def.against}</T>
          <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>Kdy: {s.def.when}</T>
          {s.def.school ? <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>Potřebné pro přijetí do mateřské školy.</T> : null}
        </>
      ) : null}
      {s.doses.length ? (
        <View style={{ gap: 4 }}>
          <T w="semibold" style={{ fontSize: 13 }}>Podané dávky</T>
          {s.doses.map((d) => (
            <Pressable key={d.id} accessibilityRole="button" onPress={() => router.push(`/zaznam/${d.id}`)} style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TypeGlyph type="vaccine" color="#2E9E6B" size={14} />
              <T style={{ fontSize: 14, textDecorationLine: 'underline' }}>{numericDate(d.date)}</T>
              {d.description ? <T numberOfLines={1} style={{ flex: 1, fontSize: 13, color: C.muted }}>{d.description}</T> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      <T w="semibold" style={{ fontSize: 13 }}>{s.nextDue ? 'Přeočkovat do ' + numericDate(s.nextDue) : s.hint || 'Přeočkování není potřeba'}</T>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/ockovani/upravit', params: { name: s.def?.name ?? s.name } })} style={({ pressed }) => ({ alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.ink, justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
        <T w="semibold" style={{ fontSize: 14, color: C.white }}>+ Zapsat dávku</T>
      </Pressable>
    </View>
  );
}

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, SectionList, TextInput, View, type ViewToken } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useData, usePerson } from '@/state/session';
import { useLoad, useNow } from '@/state/useLoad';
import { RECORD_TYPES, RECORD_TYPE_ORDER } from '@/domain/recordTypes';
import { daySummary, ensureToday, groupByDay, nowLineIndex, type TimelineDay } from '@/domain/timeline';
import { plural, toLocalDate, toLocalTime } from '@/domain/dates';
import type { Attachment, HcRecord, RecordType } from '@/domain/types';
import { Backdrop, BottomFade, Chip, H1, Muted, SecondaryButton, T, TopBar, useScreenInsets, useUi } from '@/ui/kit';
import { ActionFab, SearchPill } from '@/ui/fabs';
import { RecordCard } from '@/ui/records';
import { C, F } from '@/ui/theme';
import { IconClose, IconFilter, IconSearch } from '@/ui/icons';

/**
 * Časová osa — Mix.dc.html. Dny shora dolů od nejnovějšího, čára „Teď“
 * v dnešním dni, nadpis nahoře se mění podle dne, který je právě vidět.
 */

type Item = { kind: 'rec'; r: HcRecord; last: boolean } | { kind: 'now' } | { kind: 'empty' };
type Section = TimelineDay & { data: Item[]; idx: number };

const PAGE = 200;
// Musí být stálý objekt — SectionList nesnese změnu za běhu.
const VIEWABILITY = { itemVisiblePercentThreshold: 10, minimumViewTime: 0 };

export default function Osa() {
  const ui = useUi();
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const now = useNow();
  const today = toLocalDate(now);
  const nowTime = toLocalTime(now);

  const [limit, setLimit] = useState(PAGE);
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<RecordType[]>([]);
  const [onlyFiles, setOnlyFiles] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<SectionList<Item, Section>>(null);

  const filtering = !!query.trim() || types.length > 0 || onlyFiles;

  const { value, loading } = useLoad(async () => {
    const recs = await data.records.query({ personId: person.id, text: query, types, onlyWithAttachments: onlyFiles, limit: limit + 1 });
    const more = recs.length > limit;
    const list = more ? recs.slice(0, limit) : recs;
    const files = await data.attachments.forRecords(list.map((r) => r.id));
    return { list, files, more };
  }, [person.id, query, types.join(','), onlyFiles, limit]);

  const sections: Section[] = useMemo(() => {
    const list = value?.list ?? [];
    let days = groupByDay(list, today);
    if (!filtering) days = ensureToday(days, today);
    return days.map((d, idx) => {
      const items: Item[] = d.records.map((r, i) => ({ kind: 'rec', r, last: i === d.records.length - 1 }));
      if (d.isToday && !filtering) {
        const at = nowLineIndex(d, nowTime);
        items.splice(at, 0, { kind: 'now' });
        if (!d.records.length) items.push({ kind: 'empty' });
      }
      return { ...d, data: items, idx };
    });
  }, [value, today, nowTime, filtering]);

  const total = value?.list.length ?? 0;
  const head = sections[Math.min(active, sections.length - 1)];

  // Stálá funkce — SectionList nesnese, když se posluchač mění za běhu.
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.section);
    if (first && first.section) setActive((first.section as Section).idx);
  }, []);

  const toTop = useCallback(() => {
    if (sections.length) listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, viewOffset: 220, animated: false });
    setActive(0);
  }, [sections.length]);

  const openFile = (a: Attachment) => router.push(`/priloha/${a.id}`);

  const toggleType = (k: RecordType) => {
    setTypes((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));
  };

  const resetAll = () => {
    setQuery('');
    setTypes([]);
    setOnlyFiles(false);
  };

  const closeSearch = () => {
    Keyboard.dismiss();
    setSearchOpen(false);
    setFilterOpen(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(it, i) => (it.kind === 'rec' ? it.r.id : it.kind + i)}
        stickySectionHeadersEnabled={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={VIEWABILITY}
        contentContainerStyle={{ paddingTop: ins.top + 160, paddingBottom: ins.bottom }}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (value?.more) setLimit((l) => l + PAGE);
        }}
        renderSectionHeader={({ section }) =>
          section.idx > 0 ? (
            <View style={{ paddingTop: 40, paddingBottom: 8, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <T w="semibold" style={{ fontSize: 16, lineHeight: 24 }}>{section.title}</T>
              <Muted>{section.subtitle}</Muted>
              <View style={{ flex: 1, height: 1, backgroundColor: ui.rule, alignSelf: 'center', marginLeft: 8 }} />
            </View>
          ) : (
            <View style={{ height: 8 }} />
          )
        }
        renderItem={({ item }) => {
          if (item.kind === 'now') return <NowLine time={nowTime} />;
          if (item.kind === 'empty')
            return (
              <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
                <View style={{ width: 80 }} />
                <View style={{ flex: 1, marginRight: 16, padding: 14, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DCDAD6' }}>
                  <Muted>Dnes zatím nic. Zapište, jak se cítíte, nebo přidejte záznam.</Muted>
                </View>
              </View>
            );
          const r = item.r;
          const t = RECORD_TYPES[r.type];
          return (
            <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
              <View style={{ position: 'absolute', left: 63, top: 0, bottom: item.last ? 12 : 0, width: 1, backgroundColor: ui.rule }} />
              <T style={{ width: 48, paddingTop: 12, textAlign: 'right', fontSize: 12, lineHeight: 20, color: C.muted, fontVariant: ['tabular-nums'] }}>{r.time ?? 'celý den'}</T>
              <View style={{ width: 32, alignItems: 'center', paddingTop: 18 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color, boxShadow: '0px 0px 0px 4px #FFFFFF' }} />
              </View>
              <RecordCard r={r} files={value?.files.get(r.id)} onPress={() => router.push(`/zaznam/${r.id}`)} onOpenFile={openFile} />
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ paddingTop: 80, paddingHorizontal: 32, alignItems: 'center', gap: 8 }}>
              <T w="semibold" style={{ fontSize: 16, lineHeight: 24 }}>Nic neodpovídá hledání</T>
              <Muted style={{ textAlign: 'center' }}>Zkuste jiné slovo nebo zrušte filtr.</Muted>
              <SecondaryButton label="Zrušit filtr" onPress={resetAll} style={{ marginTop: 16, minHeight: 44 }} />
            </View>
          ) : null
        }
        ListFooterComponent={
          total > 0 ? (
            <View style={{ paddingTop: 32, paddingBottom: 8, alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[0, 1, 2].map((i) => <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#D6D4DA' }} />)}
              </View>
              <T style={{ fontSize: 12, color: C.muted }}>{value?.more ? 'Starší záznamy se načtou při posunu' : 'Tady osa začíná'}</T>
            </View>
          ) : null
        }
      />

      {/* Hlavička s mlhou — nadpis se mění podle dne, který je vidět */}
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(${ui.bgRgb},0.96)`, `rgba(${ui.bgRgb},0.88)`, `rgba(${ui.bgRgb},0.5)`, `rgba(${ui.bgRgb},0)`]}
        locations={[0, 0.55, 0.74, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ins.top + 190 }}
      />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: ins.top, paddingHorizontal: 16 }}>
        <TopBar title={person.name} backLabel="Zpět na přehled" extra={<SearchPill label="Hledat a filtrovat" active={filtering} onPress={() => setSearchOpen(true)} />} />
        <View pointerEvents="none" style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>{filtering ? 'Hledání' : head?.title ?? 'Dnes'}</H1>
          <Muted style={{ marginTop: 4 }}>
            {filtering ? total + ' ' + plural(total, 'záznam', 'záznamy', 'záznamů') : head ? daySummary(head) : ''}
          </Muted>
        </View>
      </View>

      <BottomFade />

      {searchOpen ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }} pointerEvents="box-none">
          <Pressable accessibilityLabel="Zavřít hledání" onPress={closeSearch} style={{ flex: 1, backgroundColor: 'rgba(245,245,244,0.5)' }} />
          <View style={{ paddingHorizontal: 16, paddingBottom: 32 + Math.max(0, ins.bottom - 128 - 16), gap: 8 }}>
            {filterOpen ? (
              <View style={{ padding: 16, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: C.line, boxShadow: '0px 20px 48px rgba(40,40,40,0.12)' }}>
                <T w="semibold" style={{ fontSize: 13, color: C.muted }}>Typ záznamu</T>
                <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Chip label="Vše" selected={types.length === 0} onPress={() => setTypes([])} dot={C.ink} />
                  {RECORD_TYPE_ORDER.map((k) => (
                    <Chip key={k} label={RECORD_TYPES[k].label} selected={types.includes(k)} onPress={() => toggleType(k)} dot={RECORD_TYPES[k].color} />
                  ))}
                </View>
                <T w="semibold" style={{ marginTop: 14, fontSize: 13, color: C.muted }}>Jen se soubory</T>
                <View style={{ marginTop: 8, flexDirection: 'row' }}>
                  <Chip label="Přílohu" selected={onlyFiles} onPress={() => setOnlyFiles((v) => !v)} />
                </View>
                <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
                  <SecondaryButton label="Vymazat" onPress={resetAll} style={{ flex: 1, minHeight: 48 }} />
                  <Pressable accessibilityRole="button" onPress={closeSearch} style={{ flex: 2, minHeight: 48, borderRadius: 24, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                    <T w="semibold" style={{ fontSize: 14, color: C.white }}>{'Zobrazit ' + total + ' ' + plural(total, 'záznam', 'záznamy', 'záznamů')}</T>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <View style={{ height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: C.line, padding: 7, flexDirection: 'row', alignItems: 'center', gap: 8, boxShadow: '0px 20px 48px rgba(40,40,40,0.12)' }}>
              <View style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: C.field, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
                <IconSearch size={16} color={C.muted} width={1.6} />
                <TextInput
                  autoFocus
                  accessibilityLabel="Hledat v záznamech"
                  value={query}
                  onChangeText={(s) => {
                    setQuery(s);
                    setLimit(PAGE);
                  }}
                  placeholder="Hledat…"
                  placeholderTextColor="#8E8C94"
                  returnKeyType="search"
                  onSubmitEditing={closeSearch}
                  style={{ flex: 1, height: 40, fontFamily: F.regular, fontSize: 15, color: C.ink }}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: filterOpen }}
                onPress={() => {
                  Keyboard.dismiss();
                  setFilterOpen((o) => !o);
                }}
                style={{ height: 40, paddingLeft: 10, paddingRight: 14, borderRadius: 20, backgroundColor: C.pink, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <IconFilter size={16} color={C.white} />
                <T w="semibold" style={{ fontSize: 14, color: C.white }}>{types.length + (onlyFiles ? 1 : 0) ? 'Filtr · ' + (types.length + (onlyFiles ? 1 : 0)) : 'Filtr'}</T>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Zavřít hledání" onPress={closeSearch} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <IconClose size={18} width={1.6} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <ActionFab label="Zapsat" a11y="Nový záznam" onPress={() => router.push({ pathname: '/zaznam/upravit', params: { date: today } })} />
        </>
      )}
      {/* Po změně hledání nebo filtru zpátky nahoru */}
      <ScrollToTopOnChange dep={query + types.join(',') + onlyFiles} run={toTop} />
    </View>
  );
}

function NowLine({ time }: { time: string }) {
  return (
    <View accessibilityLabel={'Teď, ' + time} style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingBottom: 12 }}>
      <T w="semibold" style={{ width: 48, textAlign: 'right', fontSize: 12, lineHeight: 20, fontVariant: ['tabular-nums'] }}>{time}</T>
      <View style={{ width: 32, alignItems: 'center' }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#F7B3C7', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 0px 0px 3px #FFFFFF, 0px 0px 16px 4px rgba(238,63,122,0.30)' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.lime }} />
          </View>
        </View>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 24 }}>
        <T w="semibold" style={{ fontSize: 14, lineHeight: 20 }}>Teď</T>
        <View style={{ flex: 1, height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#E2E0E6' }} />
      </View>
    </View>
  );
}

function ScrollToTopOnChange({ dep, run }: { dep: string; run: () => void }) {
  const prev = useRef(dep);
  React.useEffect(() => {
    if (prev.current !== dep) {
      prev.current = dep;
      run();
    }
  }, [dep, run]);
  return null;
}


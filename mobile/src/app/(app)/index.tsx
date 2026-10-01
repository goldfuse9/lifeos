import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad, useNow } from '@/state/useLoad';
import { RECORD_TYPES } from '@/domain/recordTypes';
import { isUpcoming, recordSubtitle } from '@/domain/timeline';
import { MONTHS_SHORT, WEEKDAYS_SHORT, addDays, longDate, parseLocalDate, plural, relativeDays, startOfWeek, toLocalDate, toLocalTime, vocative } from '@/domain/dates';
import { Backdrop, BottomFade, Card, DateBadge, Muted, PillButton, T, Tile, useScreenInsets, useUi } from '@/ui/kit';
import { MeFab, MoodFab } from '@/ui/fabs';
import { PrehledSearch } from '@/ui/PrehledSearch';
import { Wordmark } from '@/ui/Wordmark';
import { C } from '@/ui/theme';
import { IconCalendar, IconClose, IconPlus } from '@/ui/icons';
import type { HcRecord } from '@/domain/types';

/**
 * Přehled — vstupní obrazovka podle Prehled.dc.html.
 * Notifikace a zprávy z desky patří do fáze 2 (potřebují server), proto
 * tu zvonek není.
 */
export default function Prehled() {
  const ui = useUi();
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const { self, setPerson, account } = useSession();
  const now = useNow();
  const today = toLocalDate(now);
  const nowTime = toLocalTime(now);
  const [openUp, setOpenUp] = useState(false);
  const [openRec, setOpenRec] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const weekStart = startOfWeek(today);
  const { value } = useLoad(async () => {
    const [future, past, docs, week] = await Promise.all([
      data.records.query({ personId: person.id, from: today, order: 'asc', limit: 30 }),
      data.records.query({ personId: person.id, to: today, order: 'desc', limit: 40 }),
      data.attachments.forPerson(person.id),
      data.records.datesWithRecords(person.id, weekStart, addDays(weekStart, 6)),
    ]);
    return {
      upcoming: future.filter((r) => isUpcoming(r, today, nowTime)).slice(0, 8),
      recent: past.filter((r) => !isUpcoming(r, today, nowTime)).slice(0, 6),
      docs: docs.length,
      week,
    };
  }, [person.id, today, nowTime, weekStart]);

  const viewingOther = !!self && person.id !== self.id;
  const greetName = viewingOther ? person.name : account?.name.split(/\s+/)[0] || person.name;

  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const dt = parseLocalDate(d);
      return { d, wd: WEEKDAYS_SHORT[dt.getDay()], day: dt.getDate(), isToday: d === today, has: (value?.week.get(d) ?? 0) > 0 };
    });
  }, [weekStart, today, value]);

  const up = value?.upcoming ?? [];
  const rec = value?.recent ?? [];
  const first = up[0];
  const restUp = up.slice(1);
  const recShown = openRec ? rec : rec.slice(0, 3);

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, paddingLeft: 6 }}>
          <Wordmark />
          <PillButton accessibilityRole="button" accessibilityLabel="Kalendář" onPress={() => router.push('/kalendar')}>
            <IconCalendar color={C.muted} />
          </PillButton>
        </View>

        <View style={{ marginTop: 22, alignItems: 'center' }}>
          <T style={{ fontSize: 17, lineHeight: 22, color: C.muted }}>{viewingOther ? 'Karta' : 'Ahoj,'}</T>
          <T w="semibold" accessibilityRole="header" style={{ fontSize: 34, lineHeight: 40, letterSpacing: -1.2, textAlign: 'center' }}>
            {viewingOther ? person.name : vocative(greetName)}
          </T>
          <Muted style={{ marginTop: 4 }}>{longDate(today)}</Muted>
          {viewingOther ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zpět na moji kartu"
              onPress={() => self && setPerson(self.id)}
              style={{ marginTop: 10, height: 32, paddingLeft: 12, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, backgroundColor: ui.pill }}
            >
              <T w="semibold" style={{ fontSize: 13, color: C.ink2 }}>Zpět na moji kartu</T>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#E6E5E2', alignItems: 'center', justifyContent: 'center' }}>
                <IconClose size={12} color={C.ink2} />
              </View>
            </Pressable>
          ) : null}
        </View>

        {/* Dlaždice — vodorovný pás jako na desce (zoom 0,85 → 197 × 207) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={207} decelerationRate="fast" style={{ marginTop: 12, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 10 }}>
          <TileTimeline onPress={() => router.push('/osa')} />
          <TileDoctors onPress={() => router.push('/lekari')} />
          <TileDocs count={value?.docs ?? 0} onPress={() => router.push('/dokumenty')} />
        </ScrollView>

        {/* Blíží se */}
        <Tile style={{ marginTop: 12, paddingTop: 18, paddingHorizontal: 10, paddingBottom: 10, overflow: 'visible' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32, paddingLeft: 12, paddingRight: 6 }}>
            <View>
              <T accessibilityRole="header" style={{ fontSize: 20, lineHeight: 24, letterSpacing: -0.4, color: C.ink3 }}>Blíží se</T>
              <Muted style={{ fontSize: 13, lineHeight: 18 }}>
                {up.length ? up.length + ' ' + plural(up.length, 'termín', 'termíny', 'termínů') : 'Nic naplánováno'}
              </Muted>
            </View>
            {restUp.length ? (
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: openUp }} onPress={() => setOpenUp((o) => !o)} style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: C.white, justifyContent: 'center', boxShadow: '0px 6px 18px rgba(40,40,40,0.08)' }}>
                <T w="semibold" style={{ fontSize: 13, color: C.ink2 }}>{openUp ? 'Méně' : '+' + restUp.length}</T>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Otevřít kalendář"
            onPress={() => router.push('/kalendar')}
            style={{ marginTop: 14, paddingVertical: 6, paddingHorizontal: 2, borderRadius: 22, backgroundColor: 'rgba(23,22,26,0.035)', flexDirection: 'row', gap: 2 }}
          >
            {week.map((w) => (
              <View key={w.d} style={{ flex: 1, alignItems: 'center', gap: 3, paddingTop: 7, paddingBottom: 5, borderRadius: 18, backgroundColor: w.isToday ? C.ink : 'transparent' }}>
                <T w="semibold" style={{ fontSize: 10, lineHeight: 13, letterSpacing: 0.7, textTransform: 'uppercase', color: w.isToday ? 'rgba(255,255,255,0.75)' : C.muted }}>{w.wd}</T>
                <T w="semibold" style={{ fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'], color: w.isToday ? C.white : C.ink }}>{w.day}</T>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: w.has ? (w.isToday ? C.white : C.orange) : 'transparent' }} />
              </View>
            ))}
          </Pressable>

          <View style={{ marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 24, backgroundColor: C.white, boxShadow: '0px -4px 20px rgba(40,40,40,0.06)' }}>
            {first ? (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/zaznam/${first.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <DateBadge day={parseLocalDate(first.date).getDate()} mon={MONTHS_SHORT[parseLocalDate(first.date).getMonth()]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T w="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, color: C.ink2 }}>{first.title}</T>
                  <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{upSub(first)}</T>
                </View>
                <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 11, backgroundColor: first.date === today ? C.orangeTint : '#F1F0EE' }}>
                  <T w="semibold" style={{ fontSize: 12, lineHeight: 16, color: first.date === today ? C.orangeInk : C.muted }}>{relativeDays(first.date, today)}</T>
                </View>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/zaznam/upravit', params: { type: 'event', date: addDays(today, 1) } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
                <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: C.orangeTint, alignItems: 'center', justifyContent: 'center' }}>
                  <IconPlus size={18} color={C.orangeInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <T w="semibold" style={{ fontSize: 15, lineHeight: 20, color: C.ink2 }}>Naplánovat termín</T>
                  <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>Prohlídka, odběr, očkování…</T>
                </View>
              </Pressable>
            )}
            {openUp
              ? restUp.map((u) => {
                  const d = parseLocalDate(u.date);
                  return (
                    <Pressable key={u.id} accessibilityRole="button" onPress={() => router.push(`/zaznam/${u.id}`)} style={{ height: 48, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <T w="semibold" style={{ width: 44, textAlign: 'center', fontSize: 12, lineHeight: 16, color: C.muted, fontVariant: ['tabular-nums'] }}>{d.getDate() + '. ' + (d.getMonth() + 1) + '.'}</T>
                      <T numberOfLines={1} style={{ flex: 1, fontSize: 14, lineHeight: 18 }}>
                        <T w="semibold" style={{ fontSize: 14, color: C.ink2 }}>{u.title}</T>
                        <T style={{ fontSize: 14, color: C.muted }}>{upSub(u) ? ' · ' + upSub(u) : ''}</T>
                      </T>
                    </Pressable>
                  );
                })
              : null}
          </View>
        </Tile>

        {/* Naposledy */}
        <Card style={{ marginTop: 12, borderRadius: 20, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 40, paddingTop: 4, paddingLeft: 14, paddingRight: 8 }}>
            <T w="semibold" style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>Naposledy</T>
            {rec.length > 3 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={openRec ? 'Zobrazit méně' : 'Zobrazit další'} accessibilityState={{ expanded: openRec }} onPress={() => setOpenRec((o) => !o)} hitSlop={10} style={{ minWidth: 44, height: 36, alignItems: 'flex-end', justifyContent: 'center' }}>
                <View style={{ minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: openRec ? C.ink : 'rgba(23,22,26,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                  <T w="semibold" style={{ fontSize: 12, color: C.white }}>{openRec ? '−' : '+' + (rec.length - 3)}</T>
                </View>
              </Pressable>
            ) : null}
          </View>
          {recShown.length ? (
            recShown.map((r, i) => {
              const t = RECORD_TYPES[r.type];
              return (
                <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push(`/zaznam/${r.id}`)} style={({ pressed }) => ({ height: 60, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: i === 0 ? 'transparent' : ui.rule, backgroundColor: pressed ? 'rgba(255,255,255,0.6)' : 'transparent' })}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color }} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T w="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{r.title}</T>
                    <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{relativeDays(r.date, today) + ' · ' + t.label.toLowerCase()}</T>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Pressable accessibilityRole="button" onPress={() => router.push('/osa')} style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              <Muted>Zatím žádné záznamy. Začněte zápisem v časové ose.</Muted>
            </Pressable>
          )}
        </Card>

        {/* Nouzová karta */}
        <Pressable accessibilityRole="button" onPress={() => router.push('/nouze')} style={({ pressed }) => ({ marginTop: 12, padding: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: ui.cardW, borderWidth: 1, borderColor: ui.line, borderRadius: 20, boxShadow: ui.shadow, opacity: pressed ? 0.8 : 1 })}>
          <View style={{ width: 36, height: 36, borderRadius: 13, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 6px 16px rgba(238,63,122,0.28)' }}>
            <T w="semibold" style={{ color: C.white, fontSize: 18, lineHeight: 20 }}>+</T>
          </View>
          <View style={{ flex: 1 }}>
            <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Nouzová karta</T>
            <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>Alergie, léky a kontakt pro záchranáře</T>
          </View>
        </Pressable>
      </ScrollView>

      <BottomFade />
      {!searchOpen ? <MoodFab onPress={() => router.push('/zapis')} /> : null}
      {!searchOpen ? <MeFab onPress={() => router.push('/nastaveni')} /> : null}
      <PrehledSearch open={searchOpen} onOpen={() => setSearchOpen(true)} onClose={() => setSearchOpen(false)} />
    </View>
  );
}

function upSub(r: HcRecord): string {
  const s = recordSubtitle(r);
  return [r.time, s].filter(Boolean).join(' · ');
}

/* ---------------------------------------------------- ilustrace dlaždic */

const tileBox = { width: 197, height: 207 } as const;

function TileShell({ title, onPress, label, children }: { title: string; onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Tile style={tileBox}>
        <T style={{ position: 'absolute', top: 19, left: 19, fontSize: 17, lineHeight: 20, letterSpacing: -0.34, color: C.ink3 }}>{title}</T>
        {children}
      </Tile>
    </Pressable>
  );
}

const bar = (w: number, c = '#E6E5E2') => <View style={{ width: w, height: 3, borderRadius: 2, backgroundColor: c }} />;

function TileTimeline({ onPress }: { onPress: () => void }) {
  return (
    <TileShell title={'Časová\nosa'} label="Časová osa" onPress={onPress}>
      <View style={{ position: 'absolute', left: 34, top: 77, bottom: 51, borderLeftWidth: 2, borderStyle: 'dotted', borderColor: '#CFCDD2' }} />
      <View style={{ position: 'absolute', left: 27, top: 80, width: 128, height: 26, paddingHorizontal: 9, borderRadius: 13, backgroundColor: '#FAFAF9', boxShadow: '0px 6px 16px rgba(40,40,40,0.06)', transform: [{ rotate: '-4deg' }], flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#9B3FE0' }} />
        {bar(60)}
      </View>
      <View style={{ position: 'absolute', left: 42, top: 109, width: 136, height: 29, paddingHorizontal: 10, borderRadius: 15, backgroundColor: C.white, boxShadow: '0px 8px 20px rgba(40,40,40,0.08)', transform: [{ rotate: '3deg' }], flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: '#E2F5F9', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#0E8FA8' }} />
        </View>
        <View style={{ gap: 3 }}>{bar(54, '#D9D8DC')}{bar(34)}</View>
      </View>
      <View style={{ position: 'absolute', left: 25, top: 138, width: 119, height: 26, paddingHorizontal: 9, borderRadius: 13, backgroundColor: '#FAFAF9', boxShadow: '0px 6px 16px rgba(40,40,40,0.06)', transform: [{ rotate: '-2deg' }], flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.orange }} />
        {bar(48)}
      </View>
    </TileShell>
  );
}

function TileDoctors({ onPress }: { onPress: () => void }) {
  return (
    <TileShell title={'Moji\nlékaři'} label="Moji lékaři" onPress={onPress}>
      <View style={{ position: 'absolute', left: 31, top: 88, width: 100, height: 65, padding: 9, borderRadius: 10, backgroundColor: '#FAFAF9', boxShadow: '0px 8px 20px rgba(40,40,40,0.07)', transform: [{ rotate: '-9deg' }], flexDirection: 'row', gap: 7 }}>
        <View style={{ width: 20, height: 20, borderRadius: 7, backgroundColor: '#E8EFFD' }} />
        <View style={{ gap: 4, paddingTop: 4 }}>{bar(42, '#D9D8DC')}{bar(29)}</View>
      </View>
      <View style={{ position: 'absolute', left: 71, top: 82, width: 105, height: 71, padding: 9, borderRadius: 10, backgroundColor: C.white, boxShadow: '0px 10px 24px rgba(40,40,40,0.10)', transform: [{ rotate: '4deg' }], gap: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: '#F3E9FD' }} />
          <View style={{ gap: 3 }}>
            <T style={{ fontSize: 6, letterSpacing: 0.5, color: C.ink3 }}>MUDr.</T>
            {bar(37, '#D9D8DC')}
          </View>
        </View>
        {bar(68)}
        {bar(48)}
      </View>
    </TileShell>
  );
}

function TileDocs({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <TileShell title={'Nahrát\ndokument'} label={'Dokumenty, ' + count + ' ' + plural(count, 'soubor', 'soubory', 'souborů')} onPress={onPress}>
      <View style={{ position: 'absolute', top: 14, right: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 6px 18px rgba(40,40,40,0.08)' }}>
        <IconPlus size={18} />
      </View>
      <View style={{ position: 'absolute', left: 37, top: 88, width: 78, height: 95, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#FAFAF9', boxShadow: '0px 8px 20px rgba(40,40,40,0.08)', transform: [{ rotate: '-10deg' }], gap: 4 }}>
        {bar(26, C.faint)}
        <View style={{ height: 5 }} />
        {bar(34)}
        {bar(46)}
        {bar(30)}
      </View>
      <View style={{ position: 'absolute', left: 85, top: 78, width: 85, height: 105, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 9, backgroundColor: C.white, boxShadow: '0px 10px 24px rgba(40,40,40,0.10)', transform: [{ rotate: '5deg' }], gap: 4 }}>
        {bar(26, C.faint)}
        <View style={{ height: 5 }} />
        {bar(42)}
        {bar(36)}
        {bar(52)}
      </View>
      <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8, height: 54, paddingHorizontal: 15, borderRadius: 22, backgroundColor: C.white, justifyContent: 'center', boxShadow: '0px -4px 20px rgba(40,40,40,0.06)' }}>
        <T w="semibold" style={{ fontSize: 14, lineHeight: 18, color: C.ink2 }}>Dokumenty</T>
        <T style={{ fontSize: 12, lineHeight: 16, color: C.muted }}>{count ? count + ' ' + plural(count, 'soubor', 'soubory', 'souborů') : 'Zatím prázdné'}</T>
      </View>
    </TileShell>
  );
}

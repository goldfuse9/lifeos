import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { usePerson } from '@/state/session';
import { useNow } from '@/state/useLoad';
import { useSkolka, useSkolkaDemo } from '@/state/useSkolka';
import { isSet, pickupOptions, znackaOf, zpravaOf } from '@/domain/skolka';
import { czk, dayShortCz, isEmptyFeed, monthStats, newAlba, openSurveys, unpaid, upcomingAkce } from '@/domain/skolkaFeed';
import { MONTHS_NOM, relativeDays, toLocalDate } from '@/domain/dates';
import { Backdrop, Badge, BottomFade, Card, Divider, H1, Loading, Muted, PrimaryButton, T, Tile, TopBar, useScreenInsets, useToast } from '@/ui/kit';
import { Znacka } from '@/ui/Znacka';
import { SkLabel } from '@/ui/SkolkaScreen';
import { C } from '@/ui/theme';
import { IconChevron } from '@/ui/icons';
import type { HcRecord } from '@/domain/types';

/**
 * Školka — rodičovská strana (deska „LifeOS – karta Školka“). Nahoře co
 * je dnes, pod tím dlaždice jako na Přehledu (omluvit, zprávy, platby,
 * akce, docházka, fotky) a pár řádků (vyzvedne jiný, dotazníky,
 * nastavení). Data ze školky potřebují server (fáze 2) — do té doby jde
 * vše vyzkoušet jako ukázku.
 */
export default function Skolka() {
  const ins = useScreenInsets();
  const person = usePerson();
  const toast = useToast();
  const today = toLocalDate(useNow());
  const { value } = useSkolka();
  const demo = useSkolkaDemo();
  const [busy, setBusy] = useState(false);

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

  const { sk, feed, school } = value;
  const z = znackaOf(sk.znacka);
  const todayItems = school.filter((r) => r.date === today);
  const omluvenDnes = todayItems.some((r) => r.metadata.skolka === 'omluvenka');
  const prichod = !omluvenDnes && feed.prichod?.date === today ? feed.prichod.time : null;
  const zpravy = school.filter((r) => zpravaOf(r));
  const unread = zpravy.filter((r) => !zpravaOf(r)!.ackAt).length;
  const toPay = unpaid(feed);
  const nextAkce = upcomingAkce(feed, today).filter((a) => !a.info)[0];
  const alba = newAlba(feed);
  const surveys = openSurveys(feed);
  const people = pickupOptions(sk);
  const omluveno = new Set(school.filter((r) => r.metadata.skolka === 'omluvenka').map((r) => r.date));
  const d = new Date();
  const stats = monthStats(d.getFullYear(), d.getMonth(), today, new Set(feed.pritomen ?? []), omluveno);

  const tryDemo = async () => {
    setBusy(true);
    try {
      const how = await demo.start();
      toast(how === 'notified' ? 'Ukázka je tu — zamkněte telefon, za 5 s přijde zpráva' : 'Ukázka je tu');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nepovedlo se.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} backLabel="Zpět na přehled" />

        <View style={{ marginTop: 18, paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 8px 20px rgba(40,40,40,0.08)', transform: [{ rotate: '-4deg' }] }}>
            <Znacka value={sk.znacka} size={50} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <H1>Školka</H1>
              {feed.demo ? <Badge label="Ukázka" /> : null}
            </View>
            <Muted style={{ marginTop: 2 }} numberOfLines={2}>
              {isSet(sk) ? [sk.name, sk.trida, z ? 'značka ' + z.name : null].filter(Boolean).join(' · ') : person.name + ' · zatím nenastaveno'}
            </Muted>
          </View>
        </View>

        {!isSet(sk) ? (
          <Card style={{ marginTop: 16, padding: 16, borderRadius: 24 }}>
            <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Kam {person.name} chodí do školky?</T>
            <T style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: C.muted }}>Stačí název a telefon. Pak odsud pošlete omluvenku nebo dáte vědět, kdo dnes vyzvedne.</T>
            <PrimaryButton style={{ marginTop: 14 }} label="Nastavit školku" onPress={() => router.push('/skolka/nastavit')} />
          </Card>
        ) : (
          <>
            {/* Dnes */}
            <SkLabel>Dnes</SkLabel>
            <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
              {prichod ? (
                <View style={{ minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.okDot }} />
                  <View style={{ flex: 1 }}>
                    <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Ve školce od {prichod.replace(/^0/, '')}</T>
                    <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>oběd přihlášen</T>
                  </View>
                </View>
              ) : null}
              {todayItems.map((r, i) => (
                <View key={r.id}>
                  {i || prichod ? <Divider /> : null}
                  <SchoolRow r={r} today={today} />
                </View>
              ))}
              {!prichod && !todayItems.length ? (
                <View style={{ padding: 14 }}>
                  <T style={{ fontSize: 14, lineHeight: 20, color: C.muted }}>Nic zvláštního — vyzvedává {people.length ? 'rodič nebo pověřená osoba' : 'rodič'} jako obvykle.</T>
                </View>
              ) : null}
            </Card>

            {/* Dlaždice */}
            <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <SkTile title="Omluvit" sub="nemoc, lékař" onPress={() => router.push('/skolka/omluvit')} art={<ArtOmluvit />} />
              <SkTile title="Zprávy" sub={unread ? `${unread} ${unread === 1 ? 'nová' : 'nové'}` : zpravy.length || feed.nastenka?.length ? 'nic nového' : 'zatím nic'} badge={unread} warn={!!unread} onPress={() => router.push('/skolka/zpravy')} art={<ArtZpravy />} />
              <SkTile title="Platby" sub={toPay.length ? czk(toPay.reduce((s, p) => s + p.amount, 0)) : feed.platby?.length ? 'zaplaceno' : 'zatím nic'} badge={toPay.length} warn={!!toPay.length} onPress={() => router.push('/skolka/platby')} art={<ArtPlatby />} />
              <SkTile title="Akce" sub={nextAkce ? nextAkce.title + ' ' + dayShortCz(nextAkce.date).split(' ')[0] : 'zatím nic'} onPress={() => router.push('/skolka/akce')} art={<ArtAkce day={nextAkce ? Number(nextAkce.date.slice(8)) : null} />} />
              <SkTile title="Docházka" sub={feed.pritomen?.length ? `${MONTHS_NOM[d.getMonth()].slice(0, 3).toLowerCase()}: ${stats.inn} dní` : stats.om ? `omluveno ${stats.om}` : 'omluvenky'} onPress={() => router.push('/skolka/dochazka')} art={<ArtDochazka />} />
              <SkTile title="Fotky" sub={alba.length ? `${alba.reduce((s, a) => s + a.count, 0)} nových` : feed.alba?.length ? `${feed.alba.length} alba` : 'zatím nic'} badge={alba.length} onPress={() => router.push('/skolka/fotky')} art={<ArtFotky />} />
            </View>

            {/* Řádky */}
            <Card style={{ marginTop: 12, borderRadius: 22, overflow: 'hidden' }}>
              <IconRow title="Dnes vyzvedne někdo jiný" sub={people.length ? 'babička, děda… jen pověřené osoby' : 'nejdřív přidejte pověřené osoby'} tint="#E8EFFD" icon={<Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#27407A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M12.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 11h6M19 8l3 3-3 3" /></Svg>} onPress={() => router.push('/skolka/vyzvedne')} />
              <Divider />
              <IconRow title="Dotazníky" sub={surveys[0]?.question ?? (feed.dotazniky?.length ? 'vše zodpovězeno' : 'zatím nic')} badge={surveys.length ? 'Odpovědět' : undefined} tint="#F3E8FC" icon={<Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6B22A8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M7.5 4h9A2.5 2.5 0 0 1 19 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18.5v-12A2.5 2.5 0 0 1 7.5 4zM9 4v2h6V4M8.5 12l2 2 4-4" /></Svg>} onPress={() => router.push('/skolka/dotazniky')} />
            </Card>
            <Card style={{ marginTop: 12, borderRadius: 22, overflow: 'hidden' }}>
              <IconRow title="Nastavení školky" sub="kdo vyzvedává, co školka vidí, platby" tint="#F1F0EE" icon={<Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#2E2D33" strokeWidth={2} strokeLinecap="round"><Path d="M4 7h10M18 7h2M4 17h4M12 17h8M18 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM12 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" /></Svg>} onPress={() => router.push('/skolka/nastaveni')} />
            </Card>

            {isEmptyFeed(feed) ? (
              <Pressable accessibilityRole="button" onPress={() => (busy ? undefined : tryDemo())} style={{ marginTop: 12, padding: 14, borderRadius: 22, backgroundColor: 'rgba(59,111,224,0.07)', borderWidth: 1, borderColor: 'rgba(59,111,224,0.16)' }}>
                <T style={{ fontSize: 13, lineHeight: 18, color: '#27407A' }}>
                  Zprávy, akce, platby a fotky začnou chodit po propojení se školkou. <T w="semibold" style={{ fontSize: 13, color: '#27407A', textDecorationLine: 'underline' }}>{busy ? 'Připravuji…' : 'Vyzkoušet ukázku'}</T>
                </T>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
      <BottomFade />
    </View>
  );
}

function SchoolRow({ r, today }: { r: HcRecord; today: string }) {
  const kind = r.metadata.skolka;
  const z = zpravaOf(r);
  const dot = z ? C.orange : kind === 'omluvenka' ? C.purple : '#3B6FE0';
  const open = () => (z ? router.push({ pathname: '/skolka/zprava', params: { id: r.id } }) : router.push(`/zaznam/${r.id}`));
  return (
    <Pressable accessibilityRole="button" onPress={open} style={({ pressed }) => ({ minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pressed ? 'rgba(255,255,255,0.6)' : 'transparent' })}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{r.title}</T>
        <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{[r.date === today && z && r.time ? r.time.replace(/^0/, '') : relativeDays(r.date, today), r.description].filter(Boolean).join(' · ')}</T>
      </View>
      {z && !z.ackAt ? <Badge label="Nové" bg={C.orangeTint} fg={C.orangeInk} /> : null}
    </Pressable>
  );
}

function IconRow({ title, sub, icon, tint, badge, onPress }: { title: string; sub: string; icon: React.ReactNode; tint: string; badge?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title + (badge ? ', ' + badge : '')} onPress={onPress} style={({ pressed }) => ({ minHeight: 64, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pressed ? 'rgba(255,255,255,0.6)' : 'transparent' })}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{title}</T>
        <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{sub}</T>
      </View>
      {badge ? <Badge label={badge} bg={C.orangeTint} fg={C.orangeInk} /> : null}
      <IconChevron size={18} color={C.faint} />
    </Pressable>
  );
}

/* ----------------------------------------------- dlaždice (jako na Přehledu) */

function SkTile({ title, sub, art, badge, warn, onPress }: { title: string; sub: string; art: React.ReactNode; badge?: number; warn?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title + ', ' + sub} onPress={onPress} style={({ pressed }) => ({ width: '31%', flexGrow: 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <Tile style={{ height: 156, borderRadius: 26 }}>
        <T style={{ position: 'absolute', top: 14, left: 14, fontSize: 16, lineHeight: 20, letterSpacing: -0.3, color: C.ink3 }}>{title}</T>
        {badge ? (
          <View style={{ position: 'absolute', top: 12, right: 12, minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center' }}>
            <T w="semibold" style={{ fontSize: 11, color: C.white }}>{badge}</T>
          </View>
        ) : null}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 50, height: 62, alignItems: 'center', justifyContent: 'center' }}>{art}</View>
        <View style={{ position: 'absolute', left: 6, right: 6, bottom: 6, height: 34, paddingHorizontal: 10, borderRadius: 15, backgroundColor: C.white, justifyContent: 'center' }}>
          <T w="semibold" numberOfLines={1} style={{ fontSize: 12, color: warn ? C.orangeInk : C.ink2 }}>{sub}</T>
        </View>
      </Tile>
    </Pressable>
  );
}

const shadow = '0px 10px 22px rgba(40,40,40,0.10)';

function ArtOmluvit() {
  return (
    <View style={{ width: 52, height: 52, borderRadius: 13, backgroundColor: C.white, overflow: 'hidden', boxShadow: shadow, transform: [{ rotate: '6deg' }], alignItems: 'center' }}>
      <View style={{ alignSelf: 'stretch', height: 13, backgroundColor: C.purple }} />
      <Svg width={24} height={24} viewBox="0 0 24 24" style={{ marginTop: 7 }} fill="none" stroke={C.purple} strokeWidth={3} strokeLinecap="round"><Path d="M6 6l12 12M18 6 6 18" /></Svg>
    </View>
  );
}

function ArtZpravy() {
  return (
    <View style={{ width: 62, height: 44, borderRadius: 10, backgroundColor: C.white, boxShadow: shadow, transform: [{ rotate: '-8deg' }] }}>
      <Svg width={62} height={44} viewBox="0 0 62 44" fill="none" stroke="#3B6FE0" strokeWidth={2.4} strokeLinejoin="round"><Path d="M6 8l25 18L56 8" /></Svg>
    </View>
  );
}

function ArtPlatby() {
  return (
    <View style={{ width: 64, height: 42, borderRadius: 9, backgroundColor: '#F2B544', boxShadow: '0px 10px 22px rgba(217,146,15,0.25)', transform: [{ rotate: '-12deg' }], overflow: 'hidden' }}>
      <View style={{ marginTop: 9, height: 7, backgroundColor: '#D9920F' }} />
      <View style={{ position: 'absolute', left: 8, bottom: 8, width: 20, height: 4, borderRadius: 2, backgroundColor: '#FDF3DF' }} />
    </View>
  );
}

function ArtAkce({ day }: { day: number | null }) {
  return (
    <View style={{ width: 52, height: 56, borderRadius: 13, backgroundColor: C.white, overflow: 'hidden', boxShadow: shadow, transform: [{ rotate: '-5deg' }], alignItems: 'center' }}>
      <View style={{ alignSelf: 'stretch', height: 14, backgroundColor: C.orange }} />
      <T w="semibold" style={{ fontSize: 24, lineHeight: 38, color: C.orangeInk }}>{day ?? '·'}</T>
    </View>
  );
}

function ArtDochazka() {
  const c = ['#2E9E6B', '#2E9E6B', '#2E9E6B', '#E6E5E2', '#2E9E6B', '#C8AAF5', '#2E9E6B', '#2E9E6B', '#2E9E6B', '#2E9E6B', '#E6E5E2', '#E6E5E2'];
  return (
    <View style={{ width: 66, flexDirection: 'row', flexWrap: 'wrap', gap: 4, transform: [{ rotate: '-6deg' }] }}>
      {c.map((x, i) => (
        <View key={i} style={{ width: 13.5, height: 12, borderRadius: 4, backgroundColor: x }} />
      ))}
    </View>
  );
}

function ArtFotky() {
  return (
    <View style={{ width: 90, height: 60 }}>
      <View style={{ position: 'absolute', left: 8, top: 2, width: 54, height: 44, borderRadius: 9, backgroundColor: '#CFE3FA', borderWidth: 3, borderColor: C.white, boxShadow: shadow, transform: [{ rotate: '-10deg' }] }} />
      <View style={{ position: 'absolute', left: 26, top: 10, width: 54, height: 44, borderRadius: 9, backgroundColor: '#F7B3C7', borderWidth: 3, borderColor: C.white, boxShadow: shadow, transform: [{ rotate: '8deg' }] }}>
        <Svg width={20} height={14} viewBox="0 0 20 14" style={{ position: 'absolute', left: 6, bottom: 5 }}><Path d="M0 14L10 0l10 14z" fill={C.pink} /></Svg>
      </View>
    </View>
  );
}

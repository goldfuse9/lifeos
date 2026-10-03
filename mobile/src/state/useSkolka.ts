import { router } from 'expo-router';
import { useData, usePerson, useSession } from './session';
import { useLoad } from './useLoad';
import { demoZprava, zpravaOf, zpravaRecord, zpravaSummary, type SkolkaData } from '@/domain/skolka';
import { akceRecord, demoFeed, type SkolkaFeed } from '@/domain/skolkaFeed';
import { toLocalDate, toLocalTime } from '@/domain/dates';
import { notificationPermission, notifySchool } from '@/platform/notifications';
import type { HcRecord } from '@/domain/types';

/**
 * Školka na kartě dítěte: nastavení, co přišlo ze školky (zatím ukázka)
 * a záznamy, které se školky týkají (omluvenky, vyzvednutí, zprávy).
 */
export interface SkolkaState {
  sk: SkolkaData;
  feed: SkolkaFeed;
  /** Poznámky s metadata.skolka, nejnovější první. */
  school: HcRecord[];
  /** Kalendářní záznamy vzniklé z akcí školky: id akce → záznam. */
  akceRec: Map<string, HcRecord>;
}

export function useSkolka(extra: unknown[] = []): { value: SkolkaState | undefined; saveFeed: (f: SkolkaFeed) => Promise<void> } {
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const { value } = useLoad(async () => {
    const [sk, feed, notes, events] = await Promise.all([
      data.personData.get(person.id, 'skolka'),
      data.personData.get(person.id, 'skolkafeed'),
      data.records.query({ personId: person.id, types: ['note'], order: 'desc', limit: 200 }),
      data.records.query({ personId: person.id, types: ['event'] }),
    ]);
    const akceRec = new Map<string, HcRecord>();
    for (const r of events) {
      const id = r.metadata.skolkaAkce;
      if (typeof id === 'string') akceRec.set(id, r);
    }
    return { sk, feed, school: notes.filter((r) => !!r.metadata.skolka), akceRec };
  }, [person.id, ...extra]);

  const saveFeed = async (f: SkolkaFeed) => {
    await data.personData.set(person.id, 'skolkafeed', f);
    touch();
  };
  return { value, saveFeed };
}

/**
 * Ukázka školky: naplní nástěnku, akce, platby, fotky, dotazníky
 * a docházku, zapíše zprávu od učitelky a za 5 s ji ohlásí upozorněním.
 * Odebrání smaže vše, co ukázka vytvořila (i termíny v kalendáři).
 */
export function useSkolkaDemo() {
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();

  const start = async (): Promise<'notified' | 'opened'> => {
    const now = new Date();
    const today = toLocalDate(now);
    const sk = await data.personData.get(person.id, 'skolka');
    const feed = demoFeed(today);
    await data.personData.set(person.id, 'skolkafeed', feed);
    // Akce bez přihlášky jdou rovnou do kalendáře
    const events = await data.records.query({ personId: person.id, types: ['event'] });
    const have = new Set(events.map((r) => r.metadata.skolkaAkce));
    for (const a of feed.akce ?? []) {
      if (a.dotaznik || a.info || have.has(a.id)) continue;
      await data.records.create(person.id, akceRecord(a, true));
    }
    const notes = await data.records.query({ personId: person.id, types: ['note'], from: today, to: today });
    let rec = notes.find((r) => zpravaOf(r)?.demo);
    if (!rec) rec = await data.records.create(person.id, zpravaRecord(demoZprava(), today, toLocalTime(now), sk.name));
    touch();
    if (await notificationPermission(true)) {
      await notifySchool({ recordId: rec.id, title: (sk.name ?? 'Školka') + ' · ' + person.name, body: zpravaSummary(zpravaOf(rec)!) + ' — ošetřeno. Klepněte pro celý zápis.', inSeconds: 5 });
      return 'notified';
    }
    router.push({ pathname: '/skolka/zprava', params: { id: rec.id } });
    return 'opened';
  };

  const remove = async () => {
    await data.personData.set(person.id, 'skolkafeed', {});
    const recs = await data.records.query({ personId: person.id, types: ['note', 'event'] });
    for (const r of recs) if (zpravaOf(r)?.demo || r.metadata.skolkaDemo) await data.records.softDelete(r.id);
    touch();
  };

  return { start, remove };
}

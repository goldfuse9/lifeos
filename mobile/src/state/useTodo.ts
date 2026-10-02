import { useData, usePerson, useSession } from './session';
import { useLoad, useNow } from './useLoad';
import { useCycle } from './useCycle';
import { applicable, preventionOverview } from '@/domain/prevention';
import { vaxOverview } from '@/domain/vaccineCatalog';
import { dosesFor, medTitle } from '@/domain/meds';
import { emergencyProgress } from '@/domain/emergency';
import { numericDate, toLocalDate, toLocalTime } from '@/domain/dates';

/**
 * „K vyřešení“ — co z ostatních oddílů potřebuje pozornost. Jen věci,
 * se kterými jde něco udělat; každá vede na své místo v aplikaci.
 */
export interface TodoItem {
  key: string;
  area: string;
  title: string;
  sub: string;
  href: string;
  tone: 'warn' | 'info';
}

export function useTodo(): { items: TodoItem[]; loading: boolean } {
  const data = useData();
  const person = usePerson();
  const { settings, self } = useSession();
  const cycle = useCycle();
  const now = useNow();
  const today = toLocalDate(now);
  const nowT = toLocalTime(new Date(now.getTime() - 60 * 60 * 1000));

  const { value, loading } = useLoad(async () => {
    const [recs, personal, emergency, meds, medlog] = await Promise.all([
      data.records.query({ personId: person.id, types: ['vaccine', 'visit', 'event', 'result'] }),
      data.personData.get(person.id, 'personal'),
      data.personData.get(person.id, 'emergency'),
      data.personData.get(person.id, 'meds'),
      data.personData.get(person.id, 'medlog'),
    ]);
    const items: TodoItem[] = [];

    for (const v of vaxOverview(recs.filter((r) => r.type === 'vaccine'), person.birthDate, today)) {
      if (v.state === 'due') items.push({ key: 'vax-' + v.name, area: 'Očkování', title: v.name, sub: 'Po termínu přeočkování' + (v.nextDue ? ' (od ' + numericDate(v.nextDue) + ')' : ''), href: '/ockovani', tone: 'warn' });
      else if (v.state === 'missing') items.push({ key: 'vax-' + v.name, area: 'Očkování', title: v.name, sub: 'Chybí povinné očkování · ' + v.hint, href: '/ockovani', tone: 'warn' });
      else if (v.state === 'soon') items.push({ key: 'vax-' + v.name, area: 'Očkování', title: v.name, sub: 'Brzy přeočkovat' + (v.nextDue ? ' do ' + numericDate(v.nextDue) : ''), href: '/ockovani', tone: 'info' });
    }
    for (const p of preventionOverview(applicable(person.birthDate, personal, today), recs, today)) {
      if (p.state === 'now') items.push({ key: 'prev-' + p.def.key, area: 'Prevence', title: p.def.name, sub: 'Máte nárok — objednejte se', href: '/prevence', tone: 'info' });
    }
    const missed = dosesFor(meds.list ?? [], medlog, today).filter((d) => !d.taken && d.time < nowT);
    if (missed.length) items.push({ key: 'meds', area: 'Léky', title: missed.length === 1 ? medTitle(missed[0].med) : `${missed.length} dávky`, sub: 'Dnes nevzato · ' + missed.map((d) => d.time.replace(/^0/, '')).join(', '), href: '/leky', tone: 'warn' });
    if (emergencyProgress(emergency).filled === 0) items.push({ key: 'emergency', area: 'Nouzová karta', title: 'Karta je prázdná', sub: 'Alergie, nemoci, léky — co potřebuje záchranář', href: '/nastaveni/nouzove', tone: 'info' });
    return items;
  }, [person.id, today, nowT, person.birthDate]);

  const items = [...(value ?? [])];
  for (const w of cycle.settings.enabled && cycle.settings.mode !== 'těhotenství' ? cycle.info?.warnings ?? [] : []) {
    items.push({ key: 'cycle-' + w, area: 'Cyklus', title: w, sub: 'Stojí za to probrat s gynekologem', href: '/cyklus', tone: 'info' });
  }
  // Záloha se týká celé aplikace — jen na vlastní kartě.
  const isSelf = !self || self.id === person.id;
  const last = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : null;
  if (isSelf && (!last || now.getTime() - last > 30 * 86400_000)) {
    items.push({ key: 'backup', area: 'Záloha', title: last ? 'Záloha je starší než měsíc' : 'Zatím žádná záloha', sub: 'Při ztrátě telefonu by data zmizela', href: '/nastaveni/zaloha', tone: 'info' });
  }
  items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'warn' ? -1 : 1));
  return { items, loading: loading && !value };
}

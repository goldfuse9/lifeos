import { lastTetanusYear, matchVaccine, parseVaxCard, vaxNotices, vaxOverview } from '@/domain/vaccineCatalog';
import { vaccineRecord } from '@/domain/vaccines';
import { datesIn } from '@/domain/scanParse';
import type { HcRecord } from '@/domain/types';

const rec = (name: string, date: string, nextDue: string | null = null): HcRecord =>
  ({ id: name + date, personId: 'p', type: 'vaccine', title: '', description: '', date, time: null, metadata: vaccineRecord({ name, nextDue }).metadata, createdAt: '', updatedAt: '', deletedAt: null }) as HcRecord;

test('rozpoznání názvů a obchodních názvů', () => {
  expect(matchVaccine('Infanrix hexa')?.key).toBe('hexa');
  expect(matchVaccine('BOOSTRIX POLIO šarže AC37')?.key).toBe('dtap-ipv');
  expect(matchVaccine('Boostrix')?.key).toBe('dtap');
  expect(matchVaccine('Tetanus')?.key).toBe('tetanus');
  expect(matchVaccine('FSME-Immun Junior')?.key).toBe('tbe');
  expect(matchVaccine('Spalničky, zarděnky, příušnice')?.key).toBe('mmr');
  expect(matchVaccine('Paralen')).toBeNull();
});

test('dítě 2 roky: chybí 3. dávka hexavakcíny, MMR hotovo na věk', () => {
  const list = vaxOverview([rec('Infanrix hexa', '2024-12-01'), rec('Hexacima', '2025-02-01'), rec('Priorix', '2026-01-10')], '2024-10-01', '2026-10-02');
  const hexa = list.find((s) => s.def?.key === 'hexa')!;
  expect(hexa.state).toBe('missing');
  expect(list[0].def?.key).toBe('hexa');
  expect(list.find((s) => s.def?.key === 'mmr')!.state).toBe('notyet');
  expect(list.find((s) => s.def?.key === 'tetanus')!.state).toBe('notyet');
  const n = vaxNotices(list, '2026-10-02', true);
  expect(n.map((x) => x.title)).toContain('Chybí povinná očkování');
  expect(n.map((x) => x.title)).toContain('Sezóna očkování proti chřipce');
});

test('dospělý: tetanus po 15 letech po termínu', () => {
  const list = vaxOverview([rec('Tetavax', '2008-05-01')], '1985-04-03', '2026-10-02');
  const t = list.find((s) => s.def?.key === 'tetanus')!;
  expect(t.state).toBe('due');
  expect(t.nextDue).toBe('2023-05-01');
  expect(lastTetanusYear([rec('Boostrix', '2019-03-01')])).toBe('2019');
});

test('očkovací průkaz z textu', () => {
  const text = 'Jméno: Ema, nar. 1. 10. 2024\n1.12.2024  Infanrix hexa  A21CB\n1. 2. 2025 Hexacima\nPriorix\n10.1.2026\nRazítko lékaře';
  expect(parseVaxCard(text, '2026-10-02', datesIn).map((e) => [e.name, e.date])).toEqual([
    ['Hexavakcína', '2024-12-01'],
    ['Hexavakcína', '2025-02-01'],
    ['Spalničky, zarděnky, příušnice (MMR)', '2026-01-10'],
  ]);
});

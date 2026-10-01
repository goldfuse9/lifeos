import { buildCycleRecord, computeCycle, shiftFor, shiftLabel, type CycleLog } from '@/domain/cycle';
import type { HcRecord } from '@/domain/types';

let n = 0;
const log = (date: string, c: CycleLog): HcRecord => ({
  id: 'r' + n++, personId: 'p', type: 'cycle', title: '', description: '', date, time: null,
  metadata: { cycle: c }, createdAt: '', updatedAt: '', deletedAt: null,
});

test('bez dat: nastavení dává odhad', () => {
  const i = computeCycle({ enabled: true, lastStart: '2026-09-15', cycleLength: 28, periodLength: 5 }, [], '2026-10-01');
  expect(i.day).toBe(17);
  expect(i.nextStart).toBe('2026-10-13');
  expect(i.daysUntil).toBe(12);
  expect(i.ovulationDay).toBe(14);
  expect(i.phase).toBe('luteální');
  expect(i.inPeriod).toBe(false);
});

test('průměr ze zápisů, posun, délka menstruace, plodné dny', () => {
  const recs = [
    log('2026-07-01', { start: true, flow: 'medium' }), log('2026-07-02', { flow: 'heavy' }), log('2026-07-03', { flow: 'light' }),
    log('2026-07-31', { start: true, flow: 'medium', pain: 2 }), log('2026-08-01', { flow: 'medium' }),
    log('2026-08-30', { start: true, flow: 'light', shift: 1 }),
  ];
  const i = computeCycle({ enabled: true }, recs, '2026-09-12');
  expect(i.avgLength).toBe(30);
  expect(i.history.map((h) => h.length)).toEqual([null, 30, 30]);
  expect(i.history[2].periodDays).toBe(3);
  expect(i.day).toBe(14);
  expect(i.ovulationDay).toBe(16);
  expect(i.phase).toBe('plodné dny');
  expect(i.chance).toBe('vysoká');
  expect(i.painAvg).toBe(2);
  expect(shiftFor(i, '2026-10-02')).toBe(3);
  expect(shiftLabel(3)).toBe('o 3 dny později, než byl odhad');
  expect(shiftLabel(-1)).toBe('o 1 den dříve, než byl odhad');
});

test('menstruace probíhá, zpoždění a upozornění', () => {
  const now = computeCycle({ enabled: true, lastStart: '2026-09-29', periodLength: 5 }, [], '2026-10-01');
  expect(now.inPeriod).toBe(true);
  expect(now.phase).toBe('menstruace');
  const late = computeCycle({ enabled: true, lastStart: '2026-08-20', cycleLength: 28 }, [], '2026-10-01');
  expect(late.daysUntil).toBe(-14);
  expect(late.phase).toBe('zpoždění');
  expect(late.warnings[0]).toContain('zpoždění');
});

test('nepravidelný cyklus má rozmezí', () => {
  const recs = [log('2026-05-01', { start: true }), log('2026-05-24', { start: true }), log('2026-07-01', { start: true }), log('2026-07-27', { start: true })];
  const i = computeCycle({ enabled: true }, recs, '2026-08-05');
  expect(i.irregular).toBe(true);
  expect(i.nextRange).not.toBeNull();
});

test('záznam do osy', () => {
  const r = buildCycleRecord({ start: true, flow: 'heavy', pain: 2, symptoms: ['Křeče v podbřišku'], shift: 2, day: 1 }, ' ');
  expect(r.title).toBe('Začátek menstruace');
  expect((r.metadata.children as { label: string }[]).map((c) => c.label)).toEqual(['Krvácení', 'Příznaky', 'Bolest', 'Posun']);
  expect(buildCycleRecord({ flow: 'light', day: 3 }, '').title).toBe('Menstruace · 3. den');
});

test('nálada se propíše do osy', () => {
  const r = buildCycleRecord({ mood: 1, day: 5 }, '');
  expect(r.title).toBe('Cyklus · 5. den');
  expect(r.metadata.children).toEqual([{ label: 'Nálada', value: 'Špatně', type: 'note' }]);
});

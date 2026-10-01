import { addDays, ageOn, dayTitle, diffDays, genitive, isValidLocalDate, isValidLocalTime, longDate, monthGrid, relativeDays, vocative } from '@/domain/dates';
import { buildSymptomRecord, emptySelection, ensureToday, groupByDay, isPending, isUpcoming, nowLineIndex } from '@/domain/timeline';
import type { HcRecord } from '@/domain/types';

const rec = (date: string, time: string | null, title = 'x'): HcRecord => ({
  id: date + time + title, personId: 'p', type: 'note', title, description: '', date, time, metadata: {},
  createdAt: '', updatedAt: '', deletedAt: null,
});

test('české datumy', () => {
  expect(longDate('2026-09-24')).toBe('Čtvrtek 24. září');
  expect(dayTitle('2026-09-24', '2026-09-24')).toBe('Dnes');
  expect(dayTitle('2026-09-23', '2026-09-24')).toBe('Včera');
  expect(dayTitle('2026-09-21', '2026-09-24')).toBe('Pondělí');
  expect(dayTitle('2026-09-02', '2026-09-24')).toBe('2. září');
  expect(dayTitle('2025-09-02', '2026-09-24')).toBe('2. září 2025');
  expect(relativeDays('2026-09-27', '2026-09-24')).toBe('za 3 dny');
  expect(relativeDays('2026-10-14', '2026-09-24')).toBe('za 3 týdny');
  expect(diffDays('2026-03-28', '2026-03-30')).toBe(2); // přes změnu času
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(isValidLocalDate('2026-02-30')).toBe(false);
  expect(isValidLocalTime('24:00')).toBe(false);
  expect(ageOn('2018-03-05', '2026-03-04')).toBe(7);
  expect(monthGrid(2026, 8)[0]).toBe('2026-08-31'); // září 2026 začíná úterým
  expect(vocative('Tereza')).toBe('Terezo');
  expect(vocative('Roman')).toBe('Romane');
  expect(vocative('Petr')).toBe('Petře');
  expect(genitive('Tereza')).toBe('Terezy');
  expect(genitive('Roman')).toBe('Romana');
});

test('seskupení do dnů, prázdný Dnes a čára Teď', () => {
  const days = groupByDay([rec('2026-09-25', '10:00'), rec('2026-09-23', '20:00'), rec('2026-09-23', '08:00')], '2026-09-24');
  expect(days.map((d) => d.title)).toEqual(['Zítra', 'Včera']);
  const withToday = ensureToday(days, '2026-09-24');
  expect(withToday.map((d) => d.title)).toEqual(['Zítra', 'Dnes', 'Včera']);
  const today = groupByDay([rec('2026-09-24', '20:00'), rec('2026-09-24', '12:30'), rec('2026-09-24', '08:00')], '2026-09-24')[0];
  expect(nowLineIndex(today, '13:00')).toBe(1);
  expect(nowLineIndex(today, '07:00')).toBe(3);
  expect(isUpcoming(rec('2026-09-24', '20:00'), '2026-09-24', '13:00')).toBe(true);
  expect(isUpcoming(rec('2026-09-24', '08:00'), '2026-09-24', '13:00')).toBe(false);
});

test('zápis nálady a příznaků', () => {
  expect(buildSymptomRecord(emptySelection())).toBeNull();
  const r = buildSymptomRecord({ mood: 1, general: ['Únava'], byGroup: { head: ['Bolest hlavy'], cycle: ['Akné'] }, intensity: { head: 2 }, flow: 'Slabá' })!;
  expect(r.type).toBe('mood');
  expect(r.title).toBe('Cítí se špatně');
  expect(r.metadata.children).toEqual([
    { label: 'Hlava', value: 'Bolest hlavy · střední', type: 'symptom' },
    { label: 'Cyklus', value: 'menstruace slabá, Akné', type: 'symptom' },
  ]);
  expect(buildSymptomRecord({ ...emptySelection(), general: ['Teplota'] })!.title).toBe('Teplota');
});

test('naplánovaný záznam se v ose ukáže až hodinu po termínu', () => {
  const created = new Date(2026, 9, 1, 8, 0).toISOString();
  const base = { id: 'x', personId: 'p', type: 'visit', title: 'Návštěva', description: '', metadata: {}, createdAt: created, updatedAt: created, deletedAt: null } as HcRecord;
  const planned = { ...base, date: '2026-10-02', time: '09:00' } as HcRecord;
  expect(isPending(planned, new Date(2026, 9, 2, 9, 30))).toBe(true);
  expect(isPending(planned, new Date(2026, 9, 2, 10, 1))).toBe(false);
  // Zapsáno teď / zpětně — hned v ose.
  expect(isPending({ ...base, date: '2026-10-01', time: '08:00' } as HcRecord, new Date(2026, 9, 1, 8, 1))).toBe(false);
  expect(isPending({ ...base, date: '2026-09-30', time: null } as HcRecord, new Date(2026, 9, 1, 8, 1))).toBe(false);
  // Celodenní plán — od začátku svého dne.
  expect(isPending({ ...base, date: '2026-10-03', time: null } as HcRecord, new Date(2026, 9, 2, 23, 0))).toBe(true);
  expect(isPending({ ...base, date: '2026-10-03', time: null } as HcRecord, new Date(2026, 9, 3, 0, 1))).toBe(false);
});

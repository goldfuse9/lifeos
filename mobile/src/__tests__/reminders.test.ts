import { medRemindersFor, remindersFor, reminderTime } from '@/domain/reminders';
import { dosesFor, medRecord, medsForEmergency, toggleDose, type Med } from '@/domain/meds';
import type { HcRecord } from '@/domain/types';

const rec = (p: Partial<HcRecord>): HcRecord =>
  ({ id: 'r1', personId: 'p', type: 'visit', title: 'Kontrola u praktika', description: '', date: '2026-10-05', time: '09:00', metadata: { remind: ['1h', '1d'] }, createdAt: '', updatedAt: '', deletedAt: null, ...p }) as HcRecord;

test('časy připomínek', () => {
  expect(reminderTime(rec({}), '1h')).toEqual(new Date(2026, 9, 5, 8, 0));
  expect(reminderTime(rec({}), '1d')).toEqual(new Date(2026, 9, 4, 9, 0));
  expect(reminderTime(rec({ time: null }), '1h')).toEqual(new Date(2026, 9, 5, 8, 0));
  expect(reminderTime(rec({ time: null }), '1d')).toEqual(new Date(2026, 9, 4, 18, 0));
});

test('text je ve výchozím stavu bez názvu termínu', () => {
  const list = remindersFor([{ r: rec({}), personName: 'Jana', isSelf: true }], new Date(2026, 9, 1), false);
  expect(list.map((x) => x.body)).toEqual(['Zítra v 9:00 · naplánovaný termín', 'Za hodinu (9:00) · naplánovaný termín']);
  expect(list.every((x) => !x.body.includes('praktika'))).toBe(true);
  const named = remindersFor([{ r: rec({}), personName: 'Ema', isSelf: false }], new Date(2026, 9, 1), true);
  expect(named[0]).toMatchObject({ title: 'Připomínka · Ema', body: 'Zítra v 9:00 · Kontrola u praktika' });
});

test('minulé připomínky se neplánují, bez volby nic', () => {
  expect(remindersFor([{ r: rec({}), personName: 'Jana', isSelf: true }], new Date(2026, 9, 4, 12, 0), false)).toHaveLength(1);
  expect(remindersFor([{ r: rec({ metadata: {} }), personName: 'Jana', isSelf: true }], new Date(2026, 9, 1), false)).toHaveLength(0);
});

const med = (p: Partial<Med>): Med => ({ id: 'm1', name: 'Euthyrox', dose: '50 µg', times: ['08:00'], remind: true, active: true, ...p });

test('léky: dnešní dávky, odškrtnutí, nouzová karta, osa', () => {
  const meds = [med({}), med({ id: 'm2', name: 'Ibalgin', dose: undefined, times: [] }), med({ id: 'm3', name: 'Starý', active: false })];
  let log = {};
  expect(dosesFor(meds, log, '2026-10-01').map((d) => d.key)).toEqual(['m1@08:00']);
  log = toggleDose(log, '2026-10-01', 'm1@08:00');
  expect(dosesFor(meds, log, '2026-10-01')[0].taken).toBe(true);
  expect(dosesFor(meds, log, '2026-10-02')[0].taken).toBe(false);
  expect(medsForEmergency(meds)).toBe('Euthyrox 50 µg (8:00); Ibalgin (podle potřeby)');
  expect(medRecord('start', meds[0]).title).toBe('Začátek: Euthyrox 50 µg');
  expect(medRecord('stop', meds[0]).metadata.children).toEqual([]);
});

test('léky: denní připomínky sloučené podle času, bez názvu', () => {
  const list = medRemindersFor([{ meds: [med({}), med({ id: 'm2', name: 'B' }), med({ id: 'm3', remind: false, times: ['20:00'] })], personId: 'p', personName: 'Jana', isSelf: true }], new Date(2026, 9, 1, 9, 0), false);
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ body: '8:00 · čas na léky (2)', daily: { hour: 8, minute: 0 } });
  expect(list[0].at).toEqual(new Date(2026, 9, 2, 8, 0));
});

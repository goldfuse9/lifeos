import { remindersFor, reminderTime } from '@/domain/reminders';
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

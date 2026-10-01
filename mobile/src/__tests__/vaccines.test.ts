import { addYears, suggestedYears, tetanusYear, vaccineOverview, vaccineRecord, vaccineReminders } from '@/domain/vaccines';
import type { HcRecord } from '@/domain/types';

const rec = (id: string, name: string, date: string, nextDue: string | null): HcRecord =>
  ({ id, personId: 'p', type: 'vaccine', title: 'Očkování: ' + name, description: '', date, time: null, metadata: vaccineRecord({ name, nextDue }).metadata, createdAt: '', updatedAt: '', deletedAt: null }) as HcRecord;

test('přehled očkování: poslední dávka a stav přeočkování', () => {
  const list = vaccineOverview(
    [rec('a', 'Tetanus', '2012-05-03', '2022-05-03'), rec('b', 'Tetanus', '2016-05-03', '2026-05-03'), rec('c', 'Chřipka', '2025-10-20', '2026-10-20'), rec('d', 'COVID-19', '2021-06-01', null)],
    '2026-10-02',
  );
  expect(list.map((v) => [v.name, v.state])).toEqual([
    ['Tetanus', 'due'],
    ['Chřipka', 'soon'],
    ['COVID-19', 'none'],
  ]);
  expect(list[0].last.id).toBe('b');
  expect(tetanusYear([rec('a', 'Tetanus', '2016-05-03', null)])).toBe('2016');
});

test('návrh přeočkování a přestupný rok', () => {
  expect(suggestedYears('tetanus')).toBe(10);
  expect(suggestedYears('COVID-19')).toBeNull();
  expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
});

test('připomínka přeočkování měsíc předem, bez názvu', () => {
  const r = vaccineReminders([{ records: [rec('c', 'Chřipka', '2025-12-20', '2026-12-20')], personId: 'p', personName: 'Jana', isSelf: true }], new Date(2026, 9, 2), false);
  expect(r[0].at).toEqual(new Date(2026, 10, 20, 9, 0));
  expect(r[0].body).toBe('20. 12. 2026 · blíží se přeočkování');
});

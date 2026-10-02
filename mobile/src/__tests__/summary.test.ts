import { problemSummary, problemsIn } from '@/domain/timeline';
import { addMonthsLocal } from '@/domain/dates';
import type { HcRecord } from '@/domain/types';

const rec = (p: Partial<HcRecord>): HcRecord => ({ id: Math.random().toString(), personId: 'p', type: 'symptom', title: '', description: '', date: '2026-09-20', time: '08:00', metadata: {}, createdAt: '', updatedAt: '', deletedAt: null, ...p }) as HcRecord;

test('shrnutí potíží: počty a část dne', () => {
  const list = [
    rec({ metadata: { tags: ['Únava'], children: [{ label: 'Hlava', value: 'bolest hlavy, závrať · střední', type: 'symptom' }] } }),
    rec({ time: '07:30', metadata: { children: [{ label: 'Hlava', value: 'bolest hlavy', type: 'symptom' }] } }),
    rec({ time: '20:00', metadata: { tags: ['Únava'] } }),
    rec({ type: 'mood', metadata: { mood: 1, tags: [] } }),
    rec({ type: 'cycle', time: null, metadata: { cycle: { symptoms: ['Křeče v podbřišku'] } } }),
    rec({ type: 'visit', metadata: { tags: ['nic'] } }),
  ];
  expect(problemsIn(list[0])).toEqual(['Únava', 'Bolest hlavy', 'Závrať']);
  const s = problemSummary(list);
  expect(s[0]).toEqual({ name: 'Bolest hlavy', count: 2, usual: 'ráno' });
  expect(s.find((x) => x.name === 'Únava')).toEqual({ name: 'Únava', count: 2, usual: null });
  expect(s.map((x) => x.name)).toContain('Špatná nálada');
  expect(problemSummary(list, 10).map((x) => x.name)).not.toContain('nic');
});

test('posun o měsíce', () => {
  expect(addMonthsLocal('2026-03-31', -1)).toBe('2026-02-28');
  expect(addMonthsLocal('2026-10-02', -3)).toBe('2026-07-02');
});

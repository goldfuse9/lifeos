import { applicable, preventionOverview } from '@/domain/prevention';
import type { HcRecord } from '@/domain/types';

const visit = (key: string, date: string): HcRecord =>
  ({ id: key + date, personId: 'p', type: 'visit', title: '', description: '', date, time: null, metadata: { prevention: key }, createdAt: '', updatedAt: '', deletedAt: null }) as HcRecord;

test('nárok podle věku a pohlaví', () => {
  const keys = (birth: string | null, sex?: string, smoking?: string) => applicable(birth, { sex: sex as never, smoking }, '2026-10-02').map((d) => d.key);
  expect(keys('1985-04-03', 'muž')).toEqual(['praktik', 'zubar']);
  expect(keys('1975-04-03', 'žena')).toEqual(['praktik', 'zubar', 'gyn', 'mamo', 'kolon']);
  expect(keys('1966-01-01', 'muž', 'Denně')).toEqual(['praktik', 'zubar', 'kolon', 'prostata', 'plice']);
  expect(keys('2020-01-01')).toEqual(['praktik-deti', 'zubar-deti']);
  expect(keys(null)).toEqual(['praktik', 'zubar']);
});

test('stav: poslední, příště, naplánováno', () => {
  const defs = applicable('1985-04-03', { sex: 'muž' }, '2026-10-02');
  const list = preventionOverview(defs, [visit('praktik', '2025-01-10'), visit('zubar', '2024-03-01'), visit('zubar', '2026-11-05')], '2026-10-02');
  const praktik = list.find((s) => s.def.key === 'praktik')!;
  expect(praktik.state).toBe('ok');
  expect(praktik.nextFrom).toBe('2027-01-10');
  const zubar = list.find((s) => s.def.key === 'zubar')!;
  expect(zubar.state).toBe('planned');
  expect(list[0].def.key).toBe('zubar');
});

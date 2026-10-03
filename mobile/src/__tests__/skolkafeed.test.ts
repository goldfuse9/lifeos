import { answerSurvey, czIban, czk, demoFeed, denStav, monthStats, spayd, unpaid } from '@/domain/skolkaFeed';

test('IBAN z českého účtu', () => {
  expect(czIban('19-2000145399/0800')).toBe('CZ6508000000192000145399');
  expect(czIban('2000145399/0800')).toBe('CZ7908000000002000145399');
  expect(czIban('124/0800')).toBeNull(); // špatný kontrolní součet
  expect(czIban('nesmysl')).toBeNull();
});

test('QR platba SPAYD', () => {
  expect(spayd({ iban: 'CZ6508000000192000145399', amount: 1240, vs: '2024', msg: 'Stravné — Oliver*' })).toBe('SPD*1.0*ACC:CZ6508000000192000145399*AM:1240.00*CC:CZK*X-VS:2024*MSG:Stravne — Oliver ');
  expect(czk(1240)).toBe('1 240 Kč');
});

test('ukázka a dotazník přidá platbu', () => {
  const f = demoFeed('2026-10-02');
  expect(unpaid(f)).toHaveLength(1);
  const yes = answerSurvey(f, 'zoo', 'Ano, pojede', '2026-10-02', 'x');
  expect(unpaid(yes).map((p) => p.amount).sort()).toEqual([1240, 250]);
  const no = answerSurvey(yes, 'zoo', 'Nepojede', '2026-10-02', 'x');
  expect(unpaid(no)).toHaveLength(1);
});

test('docházka', () => {
  const pr = new Set(['2026-10-01', '2026-10-02']);
  const om = new Set(['2026-10-06']);
  expect(denStav('2026-10-03', '2026-10-02', pr, om)).toBe('volno');
  expect(denStav('2026-10-06', '2026-10-02', pr, om)).toBe('omluven');
  expect(denStav('2026-10-07', '2026-10-02', pr, om)).toBe('budouci');
  expect(monthStats(2026, 9, '2026-10-02', pr, om)).toEqual({ inn: 2, om: 1, work: 22 });
});

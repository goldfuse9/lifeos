import { datesIn, linesByPosition, parseScan, scheduleIn } from '@/domain/scanParse';

const ZPRAVA = `Endokrinologická ambulance
MUDr. Jana Nováková
Pacient: Roman Arte, nar. 3. 4. 1985
Dg: E03.9 Hypotyreóza, nespecifikovaná
Terapie:
Euthyrox 50 mcg tbl. 1-0-0 nalačno
Ibalgin 400 mg při bolesti
Vitamin D 1000 IU 1x denně večer
Kontrola za 3 měsíce s odběrem TSH.
V Praze dne 2. 10. 2026`;

test('lékařská zpráva: lékař, diagnóza, léky, kontrola, datum', () => {
  const r = parseScan(ZPRAVA, '2026-10-02');
  expect(r.kind).toBe('zprava');
  expect(r.doctor).toBe('MUDr. Jana Nováková');
  expect(r.diagnoses).toEqual(['E03.9']);
  expect(r.date).toBe('2026-10-02');
  expect(r.followUp?.date).toBe('2027-01-02');
  expect(r.meds.map((m) => [m.name, m.dose, m.times, m.asNeeded])).toEqual([
    ['Euthyrox', '50 µg', ['08:00'], false],
    ['Ibalgin', '400 mg', [], true],
    ['Vitamin D', '1000 IU', ['18:00'], false],
  ]);
});

test('kontrola s datem a časem', () => {
  const r = parseScan('Příští kontrola: 12. 11. 2026 v 8:30\nMUDr. Petr Malý', '2026-10-02');
  expect(r.followUp).toMatchObject({ date: '2026-11-12', time: '08:30' });
});

test('žádanka a recept', () => {
  expect(parseScan('ŽÁDANKA o vyšetření\nDg: M54.5', '2026-10-02').kind).toBe('zadanka');
  expect(parseScan('Rp.\nAugmentin 1g tbl 1-0-1', '2026-10-02')).toMatchObject({ kind: 'recept', meds: [{ name: 'Augmentin', dose: '1 g', times: ['08:00', '18:00'] }] });
});

test('dávkovací schémata', () => {
  expect(scheduleIn('½-0-½')?.times).toEqual(['08:00', '18:00']);
  expect(scheduleIn('1-1-1-1')?.times).toEqual(['08:00', '12:00', '18:00', '22:00']);
  expect(scheduleIn('2x denně')?.times).toEqual(['08:00', '18:00']);
  expect(scheduleIn('tel. 777-123-456')).toBeNull();
  expect(datesIn('12. listopadu 2026', 2026)[0].date).toBe('2026-11-12');
});

test('řádky podle polohy (tabulka ve zprávě)', () => {
  const t = linesByPosition([
    { text: '1-0-0', top: 100, left: 300, height: 20 },
    { text: 'Euthyrox 50 mcg', top: 102, left: 20, height: 20 },
    { text: 'Terapie:', top: 60, left: 20, height: 20 },
  ]);
  expect(t).toBe('Terapie:\nEuthyrox 50 mcg  1-0-0');
});

import { SHARE_DEFAULT, ZNACKY, dayShort, omluvaDays, omluvaText, pickupOptions, shareOf, showSkolka, skolkaAge, smsUrl, vyzvText, znackaOf } from '@/domain/skolka';

test('školka se nabízí dětem 3–7 let, nastavená zůstává i potom', () => {
  expect(skolkaAge('2022-02-11', '2026-10-03')).toBe(true); // 4 roky
  expect(skolkaAge('2023-11-01', '2026-10-03')).toBe(false); // ještě 2
  expect(skolkaAge('2018-03-05', '2026-10-03')).toBe(false); // 8 let
  expect(skolkaAge('2019-03-05', '2026-10-03')).toBe(true); // 7 let — odklad
  expect(skolkaAge(null, '2026-10-03')).toBe(false);
  expect(showSkolka('2018-03-05', { name: 'MŠ Sluníčko' }, '2026-10-03')).toBe(true);
  expect(showSkolka(null, {}, '2026-10-03')).toBe(false);
});

test('omluvenka: dny a text bez skloňování jména', () => {
  expect(omluvaDays('dnes', '2026-10-02')).toEqual(['2026-10-02']);
  expect(omluvaDays('dnes-zitra', '2026-10-02')).toEqual(['2026-10-02', '2026-10-03']);
  expect(dayShort('2026-10-02')).toBe('pá 2. 10.');
  expect(omluvaText({ child: 'Oliver', days: omluvaDays('zitra', '2026-10-01'), proc: 'Nemoc', parent: 'Tereza' })).toBe(
    'Dobrý den, posílám omluvenku: Oliver — pá 2. 10. — nemoc. Děkuji, Tereza',
  );
});

test('vyzvednutí jen pověřenými osobami', () => {
  expect(pickupOptions({ poverene: [' babička Věra ', '', 'děda Karel'] })).toEqual(['babička Věra', 'děda Karel']);
  expect(vyzvText({ child: 'Oliver', who: 'babička Věra', kdy: 'Po spaní', parent: null })).toBe('Dobrý den, dnes vyzvedne: Oliver — po spaní — babička Věra. Děkuji');
});

test('SMS odkaz pro iOS a Android', () => {
  expect(smsUrl('+420 777 123 456', 'a b', true)).toBe('sms:+420777123456&body=a%20b');
  expect(smsUrl('777 123 456', 'a', false)).toBe('sms:777123456?body=a');
});

test('sdílení: výchozí jen to, co ke dni patří', () => {
  expect(shareOf({})).toEqual(SHARE_DEFAULT);
  expect(shareOf({ share: { ockovani: true } }).ockovani).toBe(true);
  expect(SHARE_DEFAULT.anamneza).toBe(false);
});

test('značky: 28 jedinečných, sněhulák existuje', () => {
  expect(ZNACKY).toHaveLength(28);
  expect(new Set(ZNACKY.map((z) => z.key)).size).toBe(28);
  expect(znackaOf('snehulak')?.name).toBe('sněhulák');
  expect(znackaOf('neni')).toBeNull();
});

test('zpráva ze školky — shrnutí a záznam', () => {
  const { demoZprava, zpravaSummary, zpravaRecord, zpravaOf, vyzvDrivText } = jest.requireActual('@/domain/skolka') as typeof import('@/domain/skolka');
  const z = demoZprava();
  expect(zpravaSummary(z)).toBe('Zvýšená teplota 37,6 °C · Odřené koleno');
  const r = zpravaRecord(z, '2026-10-03', '14:20', 'MŠ Sluníčko');
  expect(r.metadata!.badge).toBe('Ze školky');
  // Ukázka je i v ose poznat jako ukázka, skutečná zpráva ne
  expect(r.title).toBe('Ukázka: zpráva ze školky');
  expect(zpravaRecord({ ...z, demo: false }, '2026-10-03', '14:20').title).toBe('Zpráva ze školky');
  expect(r.metadata!.children).toHaveLength(4);
  expect(zpravaOf({ metadata: r.metadata! })?.items[1].kind).toBe('uraz');
  expect(zpravaOf({ metadata: { skolka: 'omluvenka' } })).toBeNull();
  expect(vyzvDrivText({ child: 'Oliver', parent: 'Roman' })).toContain('Oliver — vyzvednu dnes dřív');
});

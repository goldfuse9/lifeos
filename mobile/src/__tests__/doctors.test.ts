import { buildIndex, roleFor, searchRegistry, type RegistryRow } from '@/domain/doctorRegistry';

const ROWS: RegistryRow[] = [
  ['MUDr. Jana Horáková', 'Praktický lékař s.r.o.', 'všeobecné praktické lékařství', 'Praha 2', 'Šumavská 12', '+420 222 111 333'],
  ['MUDr. Eva Nováková', '', 'praktické lékařství pro děti a dorost', 'Praha 2', 'Jugoslávská 5', ''],
  ['MDDr. Petr Šimek', 'Zubní ordinace', 'zubní lékařství', 'Benešov', 'Masarykovo nám. 1', '317 000 000'],
  ['MUDr. Pavel Král', 'ORL Král', 'otorinolaryngologie', 'Praha 2', 'Vinohradská 30', ''],
  ['MUDr. Jan Novák', '', 'gynekologie a porodnictví', 'Brno', 'Údolní 3', ''],
];
const idx = buildIndex(ROWS);

test('hledá bez diakritiky a podle více slov', () => {
  expect(searchRegistry(idx, 'novak').map((s) => s.name).sort()).toEqual(['MUDr. Eva Nováková', 'MUDr. Jan Novák']);
  expect(searchRegistry(idx, 'novak brno').map((s) => s.name)).toEqual(['MUDr. Jan Novák']);
  expect(searchRegistry(idx, 'MUDr. horak')[0].phone).toBe('+420 222 111 333');
  expect(searchRegistry(idx, 'zubni benesov')[0].role).toBe('zubar');
  expect(searchRegistry(idx, 'k')).toEqual([]);
});

test('obor → role a místo', () => {
  expect(roleFor('praktické lékařství pro děti a dorost')).toBe('pediatr');
  expect(roleFor('všeobecné praktické lékařství')).toBe('praktik');
  expect(roleFor('gynekologie a porodnictví')).toBe('gyn');
  const orl = searchRegistry(idx, 'kral')[0];
  expect(orl.role).toBe('spec');
  expect(orl.specialty).toBe('otorinolaryngologie');
  expect(orl.place).toBe('ORL Král, Vinohradská 30, Praha 2');
});

import { buildDrugIndex, matchDrugInLine, prettyName, prettyStrength, searchDrugs, type DrugRow } from '@/domain/drugRegistry';

const rows: DrugRow[] = [
  ['0012345', 'EUTHYROX', '50MCG', 'tableta', 'H03AA01', 1],
  ['0012347', 'EUTHYROX', '100MCG', 'tableta', 'H03AA01', 1],
  ['0022222', 'IBALGIN 400', '400MG', 'potahovaná tableta', 'M01AE01', 1],
  ['0099999', 'ANTIBIOTIKUM X', '500MG/5ML', 'prášek pro suspenzi', 'J01', 0],
];
const index = buildDrugIndex(rows);

test('našeptávání léků ze SÚKL', () => {
  const s = searchDrugs(index, 'euthy 50');
  expect(s[0]).toEqual({ code: '0012345', name: 'Euthyrox', strength: '50 µg', form: 'tableta', atc: 'H03AA01' });
  expect(searchDrugs(index, 'ibal')[0].name).toBe('Ibalgin 400');
  expect(prettyStrength('500MG/5ML')).toBe('500 mg/5 ml');
  expect(prettyName('Euthyrox')).toBe('Euthyrox');
});

test('lék v řádku ze skeneru', () => {
  expect(matchDrugInLine(index, 'Euthyrox 50 mcg tbl. 1-0-0')?.name).toBe('Euthyrox');
  expect(matchDrugInLine(index, 'Kontrola za 3 měsíce')).toBeNull();
});

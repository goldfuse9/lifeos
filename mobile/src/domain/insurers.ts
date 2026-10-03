/** Zdravotní pojišťovny v ČR — kód a zkratka. */
export const INSURERS: [string, string][] = [
  ['111', 'VZP ČR'],
  ['201', 'VoZP ČR'],
  ['205', 'ČPZP'],
  ['207', 'OZP'],
  ['209', 'ZPŠ'],
  ['211', 'ZP MV ČR'],
  ['213', 'RBP'],
];

export const insurerName = (code?: string) => INSURERS.find((i) => i[0] === code)?.[1] ?? null;

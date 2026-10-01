import { HcData } from '@/services/hcData';
import { BackupError, collectBackup, openBackup, readBackupHeader, restoreBackup, sealBackup, type BackupFiles } from '@/services/backup';
import { fixedClock, memoryDriver, memoryFileStore, nodeRandom, uuid } from './helpers';

function memFiles(): BackupFiles & { m: Map<string, Uint8Array> } {
  const m = new Map<string, Uint8Array>();
  return { m, read: async (n) => m.get(n)!, write: (n, b) => void m.set(n, b), exists: (n) => m.has(n) };
}

test('záloha: zašifruje, se správným heslem obnoví vše, se špatným ne', async () => {
  const fs = memoryFileStore({ 'file:///a.jpg': 3 });
  const src = await HcData.open(memoryDriver(), fs, fixedClock(), uuid);
  const me = await src.persons.create({ name: 'Jana', relation: 'self', isSelf: true });
  const r = await src.records.create(me.id, { type: 'visit', title: 'Kontrola u praktika', description: '', date: '2026-09-24', time: '08:00' });
  const gone = await src.records.create(me.id, { type: 'note', title: 'Smazané', description: '', date: '2026-09-24', time: null });
  await src.records.softDelete(gone.id);
  const a = await src.files.add(r.id, me.id, { uri: 'file:///a.jpg', name: 'foto.jpg', mimeType: 'image/jpeg' });
  await src.personData.set(me.id, 'emergency', { allergies: 'Penicilin' });
  await src.settings.set({ background: 'teplé' as never });

  const files = memFiles();
  files.m.set(a.fileName, new Uint8Array([1, 2, 3]));
  const content = await collectBackup(src.db, files, { name: 'Jana Nová', email: 'jana@example.cz' }, new Date('2026-10-01T10:00:00Z'));
  const sealed = await sealBackup(content, 'tajneheslo123', nodeRandom);

  // Bez hesla nejsou vidět data ani jméno.
  const text = Buffer.from(sealed).toString('latin1');
  expect(text).not.toContain('Penicilin');
  expect(text).not.toContain('Jana');
  expect(readBackupHeader(sealed).createdAt).toBe('2026-10-01T10:00:00.000Z');

  await expect(openBackup(sealed, 'spatneheslo')).rejects.toBeInstanceOf(BackupError);
  const tampered = sealed.slice();
  tampered[tampered.length - 5] ^= 1;
  await expect(openBackup(tampered, 'tajneheslo123')).rejects.toBeInstanceOf(BackupError);

  const opened = await openBackup(sealed, 'tajneheslo123');
  expect(opened.account.email).toBe('jana@example.cz');

  // Obnova do nové databáze, kde už je výchozí karta z registrace.
  const dst = await HcData.open(memoryDriver(), memoryFileStore(), fixedClock(), uuid);
  await dst.persons.create({ name: 'Jana', relation: 'self', isSelf: true });
  const out = memFiles();
  await restoreBackup(dst.db, out, opened);

  const persons = await dst.persons.list();
  expect(persons).toHaveLength(1);
  expect(persons[0].id).toBe(me.id);
  const recs = await dst.records.query({ personId: me.id });
  expect(recs.map((x) => x.title)).toEqual(['Kontrola u praktika']);
  expect((await dst.personData.get(me.id, 'emergency')).allergies).toBe('Penicilin');
  expect((await dst.settings.get()).background).toBe('teplé');
  expect([...out.m.get(a.fileName)!]).toEqual([1, 2, 3]);
});

test('cizí soubor není záloha', async () => {
  expect(() => readBackupHeader(new Uint8Array([1, 2, 3, 4]))).toThrow(BackupError);
});

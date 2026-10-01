import { HcData } from '@/services/hcData';
import { SCHEMA_VERSION } from '@/data/migrations';
import { fixedClock, memoryDriver, memoryFileStore, uuid } from './helpers';

async function setup() {
  const clock = fixedClock();
  const files = memoryFileStore({ 'file:///picked/zprava.pdf': 180_000, 'file:///picked/foto.jpg': 860_000, 'file:///picked/huge.bin': 60 * 1024 * 1024 });
  const data = await HcData.open(memoryDriver(), files, clock, uuid);
  const me = await data.persons.create({ name: 'Jana', relation: 'self', isSelf: true });
  return { data, clock, files, me };
}

describe('migrace', () => {
  test('nastaví verzi a jdou spustit znovu', async () => {
    const { data } = await setup();
    const v = await data.db.first<{ user_version: number }>('PRAGMA user_version');
    expect(Number(v!.user_version)).toBe(SCHEMA_VERSION);
    await HcData.open(data.db, memoryFileStore(), fixedClock(), uuid);
  });
});

describe('záznamy', () => {
  test('vytvoření, načtení, úprava, smazání', async () => {
    const { data, clock, me } = await setup();
    const r = await data.records.create(me.id, { type: 'visit', title: ' Lékařská kontrola ', description: 'U praktika', date: '2026-09-24', time: '08:00' });
    expect(r.title).toBe('Lékařská kontrola');
    expect(r.time).toBe('08:00');
    clock.tick();
    const u = await data.records.update(r.id, { title: 'Kontrola', time: null, metadata: { place: 'MUDr. X' } });
    expect(u.title).toBe('Kontrola');
    expect(u.time).toBeNull();
    expect(u.metadata.place).toBe('MUDr. X');
    expect(u.updatedAt > r.updatedAt).toBe(true);
    await data.records.softDelete(r.id);
    expect(await data.records.get(r.id)).toBeNull();
    expect(await data.records.count(me.id)).toBe(0);
  });

  test('osa je chronologická: den sestupně, čas sestupně, celodenní na konci dne', async () => {
    const { data, me } = await setup();
    const mk = (date: string, time: string | null, title: string) => data.records.create(me.id, { type: 'note', title, description: '', date, time });
    await mk('2026-09-24', '08:00', 'kontrola');
    await mk('2026-09-24', '20:00', 'poznámka');
    await mk('2026-09-24', '12:30', 'symptom');
    await mk('2026-09-24', null, 'celý den');
    await mk('2026-09-25', '18:00', 'lék');
    await mk('2026-09-23', '09:00', 'včera');
    const list = await data.records.query({ personId: me.id });
    expect(list.map((r) => r.title)).toEqual(['lék', 'poznámka', 'symptom', 'kontrola', 'celý den', 'včera']);
    const asc = await data.records.query({ personId: me.id, order: 'asc', from: '2026-09-24', to: '2026-09-24' });
    expect(asc.map((r) => r.title)).toEqual(['celý den', 'kontrola', 'symptom', 'poznámka']);
  });

  test('filtr podle typu, textu a příloh; osoby se nemíchají', async () => {
    const { data, me } = await setup();
    const kid = await data.persons.create({ name: 'Tom', relation: 'child', birthDate: '2018-03-05' });
    const a = await data.records.create(me.id, { type: 'result', title: 'CRP', description: '12 mg/l', date: '2026-09-24', time: '14:00' });
    await data.records.create(me.id, { type: 'symptom', title: 'Teplota 38,2 °C', description: 'kašel', date: '2026-09-24', time: '07:30', metadata: { children: [{ label: 'Hlava', value: 'Rýma', type: 'symptom' }] } });
    await data.records.create(kid.id, { type: 'result', title: 'CRP dítě', description: '', date: '2026-09-24', time: '10:00' });
    await data.files.add(a.id, me.id, { uri: 'file:///picked/zprava.pdf', name: 'Zpráva 100%.pdf' });

    expect((await data.records.query({ personId: me.id, types: ['result'] })).map((r) => r.title)).toEqual(['CRP']);
    expect((await data.records.query({ personId: me.id, text: 'kaš' })).map((r) => r.title)).toEqual(['Teplota 38,2 °C']);
    expect((await data.records.query({ personId: me.id, text: 'rýma' })).length).toBe(1);
    expect((await data.records.query({ personId: me.id, text: 'zpráva' })).map((r) => r.title)).toEqual(['CRP']);
    expect((await data.records.query({ personId: me.id, text: '100%' })).length).toBe(1);
    expect((await data.records.query({ personId: me.id, text: '%' })).length).toBe(1);
    expect((await data.records.query({ personId: me.id, onlyWithAttachments: true })).map((r) => r.title)).toEqual(['CRP']);
    expect((await data.records.query({ personId: kid.id })).map((r) => r.title)).toEqual(['CRP dítě']);
  });

  test('tečky do kalendáře', async () => {
    const { data, me } = await setup();
    await data.records.create(me.id, { type: 'event', title: 'Odběr', description: '', date: '2026-10-14', time: '07:30' });
    await data.records.create(me.id, { type: 'event', title: 'Zubař', description: '', date: '2026-10-14', time: '10:00' });
    await data.records.create(me.id, { type: 'event', title: 'Mimo', description: '', date: '2026-11-03', time: '10:00' });
    const m = await data.records.datesWithRecords(me.id, '2026-10-01', '2026-10-31');
    expect(m.get('2026-10-14')).toBe(2);
    expect(m.has('2026-11-03')).toBe(false);
  });
});

describe('přílohy', () => {
  test('přidání, víc příloh, odebrání a úklid', async () => {
    const { data, files, me } = await setup();
    const r = await data.records.create(me.id, { type: 'doc', title: 'Očkovací průkaz', description: '', date: '2026-09-23', time: null });
    const a1 = await data.files.add(r.id, me.id, { uri: 'file:///picked/foto.jpg', name: '../../etc/foto.jpg' });
    const a2 = await data.files.add(r.id, me.id, { uri: 'file:///picked/zprava.pdf', name: 'zprava.pdf', mimeType: 'application/pdf' });
    expect(a1.name).toBe('foto.jpg');
    expect(a1.kind).toBe('photo');
    expect(a1.mimeType).toBe('image/jpeg');
    expect(a2.kind).toBe('pdf');
    expect(a1.fileName).not.toContain('foto');
    expect((await data.attachments.forRecord(r.id)).length).toBe(2);
    expect((await data.attachments.forPerson(me.id))[0].recordTitle).toBe('Očkovací průkaz');

    await data.files.remove(a1.id);
    expect(files.exists(a1.fileName)).toBe(false);
    expect((await data.attachments.forRecord(r.id)).map((a) => a.id)).toEqual([a2.id]);

    await data.records.softDelete(r.id);
    expect((await data.attachments.forPerson(me.id)).length).toBe(0);
    expect(await data.files.collectGarbage()).toBe(1);
    expect(files.list()).toEqual([]);
  });

  test('příliš velký soubor se odmítne a nezůstane v sandboxu', async () => {
    const { data, files, me } = await setup();
    const r = await data.records.create(me.id, { type: 'doc', title: 'x', description: '', date: '2026-09-23', time: null });
    await expect(data.files.add(r.id, me.id, { uri: 'file:///picked/huge.bin', name: 'huge.bin' })).rejects.toThrow('50 MB');
    expect(files.list()).toEqual([]);
  });

  test('chyba databáze uklidí zkopírovaný soubor', async () => {
    const { data, files, me } = await setup();
    await expect(data.files.add('neexistuje', me.id, { uri: 'file:///picked/foto.jpg', name: 'foto.jpg' })).rejects.toThrow();
    expect(files.list()).toEqual([]);
  });
});

describe('osoby, údaje, nastavení', () => {
  test('smazání karty smaže i její záznamy; vlastní kartu smazat nejde', async () => {
    const { data, me } = await setup();
    const kid = await data.persons.create({ name: 'Ema', relation: 'child' });
    await data.records.create(kid.id, { type: 'note', title: 'x', description: '', date: '2026-09-23', time: null });
    await data.persons.softDelete(kid.id);
    expect((await data.persons.list()).map((p) => p.name)).toEqual(['Jana']);
    expect(await data.records.count(kid.id)).toBe(0);
    await expect(data.persons.softDelete(me.id)).rejects.toThrow();
  });

  test('osobní a nouzové údaje se ukládají po kartách a prázdné hodnoty mizí', async () => {
    const { data, me } = await setup();
    await data.personData.set(me.id, 'emergency', { allergies: ' penicilin ', blood: '0+', meds: '' });
    expect(await data.personData.get(me.id, 'emergency')).toEqual({ allergies: 'penicilin', blood: '0+' });
    await data.personData.set(me.id, 'emergency', { allergies: 'pyl' });
    expect(await data.personData.get(me.id, 'emergency')).toEqual({ allergies: 'pyl' });
    expect(await data.personData.get(me.id, 'personal')).toEqual({});
  });

  test('nastavení mají výchozí hodnoty a přežijí znovuotevření', async () => {
    const { data } = await setup();
    expect((await data.settings.get()).autoLockSeconds).toBe(60);
    await data.settings.set({ biometricEnabled: true, autoLockSeconds: 0, nesmysl: 1 } as never);
    const again = await HcData.open(data.db, memoryFileStore(), fixedClock(), uuid);
    const s = await again.settings.get();
    expect(s.biometricEnabled).toBe(true);
    expect(s.autoLockSeconds).toBe(0);
    expect('nesmysl' in s).toBe(false);
  });
});

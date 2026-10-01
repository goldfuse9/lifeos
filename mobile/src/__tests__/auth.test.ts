import { AuthError, AuthService, lockoutMs, passwordProblem } from '@/services/auth';
import { memoryKeyStore, nodeRandom } from './helpers';

jest.setTimeout(60_000);

function setup() {
  let t = Date.parse('2026-10-01T08:00:00Z');
  const store = memoryKeyStore();
  const auth = new AuthService(store, nodeRandom, () => t);
  return { store, auth, advance: (ms: number) => (t += ms) };
}

const REG = { name: 'Jana Nováková', email: 'Jana@Example.cz', password: 'kocka-pes-2026' };

test('registrace neuloží heslo ani klíč databáze v čitelné podobě', async () => {
  const { store, auth } = setup();
  const dek = await auth.register(REG);
  expect(dek).toMatch(/^[0-9a-f]{64}$/);
  const dump = [...store.data.values()].join('\n');
  expect(dump).not.toContain(REG.password);
  expect(dump).not.toContain(dek);
  expect((await auth.account())!.email).toBe('jana@example.cz');
});

test('přihlášení vrací stejný klíč; e-mail nezáleží na velikosti písmen', async () => {
  const { auth } = setup();
  const dek = await auth.register(REG);
  expect(await auth.login(' JANA@example.cz ', REG.password)).toBe(dek);
});

test('špatné heslo i špatný e-mail se odmítnou stejnou hláškou', async () => {
  const { auth } = setup();
  await auth.register(REG);
  await expect(auth.login(REG.email, 'spatne-heslo')).rejects.toThrow('E-mail nebo heslo nesedí.');
  await expect(auth.login('jiny@example.cz', REG.password)).rejects.toThrow('E-mail nebo heslo nesedí.');
});

test('po pěti chybách se přihlášení zablokuje a po čase zase pustí', async () => {
  const { auth, advance } = setup();
  await auth.register(REG);
  for (let i = 0; i < 4; i++) await expect(auth.login(REG.email, 'x')).rejects.toMatchObject({ code: 'bad_credentials' });
  await expect(auth.login(REG.email, 'x')).rejects.toMatchObject({ code: 'locked' });
  await expect(auth.login(REG.email, REG.password)).rejects.toMatchObject({ code: 'locked' });
  advance(31_000);
  await expect(auth.login(REG.email, REG.password)).resolves.toMatch(/^[0-9a-f]{64}$/);
  expect(await auth.retryAfter()).toBe(0);
});

test('změna hesla zachová klíč databáze', async () => {
  const { auth } = setup();
  const dek = await auth.register(REG);
  await expect(auth.changePassword('spatne', 'nove-heslo-123')).rejects.toBeInstanceOf(AuthError);
  await auth.changePassword(REG.password, 'nove-heslo-123');
  await expect(auth.login(REG.email, REG.password)).rejects.toBeInstanceOf(AuthError);
  expect(await auth.login(REG.email, 'nove-heslo-123')).toBe(dek);
});

test('biometrie vrací klíč, zrušení a selhání se poznají', async () => {
  const { auth, store } = setup();
  const dek = await auth.register(REG);
  await expect(auth.unlockWithBiometric('x')).rejects.toMatchObject({ code: 'bio_unavailable' });
  expect(await auth.biometricEnabled()).toBe(false);
  await auth.enableBiometric(dek);
  expect(await auth.biometricEnabled()).toBe(true);
  expect(await auth.unlockWithBiometric('x')).toBe(dek);
  store.bioFails = true;
  await expect(auth.unlockWithBiometric('x')).rejects.toMatchObject({ code: 'bio_failed' });
  store.bioFails = false;
  await auth.disableBiometric();
  expect(await auth.biometricEnabled()).toBe(false);
  await expect(auth.unlockWithBiometric('x')).rejects.toMatchObject({ code: 'bio_unavailable' });
});

test('druhý účet ve stejném telefonu nejde; wipe ho smaže', async () => {
  const { auth } = setup();
  await auth.register(REG);
  await expect(auth.register(REG)).rejects.toBeInstanceOf(AuthError);
  await auth.wipe();
  expect(await auth.hasAccount()).toBe(false);
});

test('validace registrace', async () => {
  const { auth } = setup();
  await expect(auth.register({ ...REG, name: ' ' })).rejects.toThrow('jméno');
  await expect(auth.register({ ...REG, email: 'jana' })).rejects.toThrow('E-mail');
  await expect(auth.register({ ...REG, password: 'kratke' })).rejects.toMatchObject({ code: 'weak_password' });
  expect(passwordProblem('aaaaaaaaaa')).not.toBeNull();
  expect(passwordProblem('12345678abc')).not.toBeNull();
  expect(passwordProblem('dobre-heslo')).toBeNull();
  expect(lockoutMs(4)).toBe(0);
  expect(lockoutMs(6)).toBe(60_000);
  expect(lockoutMs(30)).toBe(15 * 60_000);
});

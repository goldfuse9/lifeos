import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { AuthService } from '@/services/auth';
import { HcData } from '@/services/hcData';
import type { Account, AppSettings, Id, Person } from '@/domain/types';
import { DEFAULT_SETTINGS } from '@/domain/types';
import { openEncryptedDb, deleteDb } from '@/platform/sqlite';
import { biometricInfo, newId, randomBytes, secureKeyStore, type BiometricInfo } from '@/platform/secure';
import { sandboxFiles } from '@/platform/files';

/**
 * Stav relace aplikace.
 *
 *   loading → welcome (žádný účet) → onboarding (účet vytvořen, nabídka biometrie) → unlocked
 *   loading → locked (účet je) → unlocked
 *   unlocked → locked (odhlášení, návrat z pozadí po limitu)
 *
 * Klíč databáze existuje v paměti jen uvnitř otevřeného spojení. Při
 * zamčení se spojení zavře a všechna data z paměti zahodí.
 */

export type Status = 'loading' | 'welcome' | 'onboarding' | 'locked' | 'unlocked';

interface SessionValue {
  status: Status;
  account: Account | null;
  data: HcData | null;
  settings: AppSettings;
  persons: Person[];
  person: Person | null;
  self: Person | null;
  /** Zvyšuje se po každém zápisu — obrazovky podle něj načítají znovu. */
  version: number;
  bio: BiometricInfo | null;
  /** Je v pozadí / přepínači aplikací — obsah se zakryje. */
  covered: boolean;

  register(input: { name: string; email: string; password: string }): Promise<void>;
  finishOnboarding(enableBio: boolean): Promise<void>;
  loginPassword(email: string, password: string): Promise<void>;
  loginBiometric(): Promise<void>;
  lock(): Promise<void>;
  wipeEverything(): Promise<void>;
  setPerson(id: Id): Promise<void>;
  touch(): void;
  reloadPersons(): Promise<void>;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  enableBiometric(password: string): Promise<void>;
  disableBiometric(): Promise<void>;
  changePassword(oldPw: string, newPw: string): Promise<void>;
  updateAccount(patch: Partial<Pick<Account, 'name' | 'email'>>): Promise<void>;
  auth: AuthService;
}

const Ctx = createContext<SessionValue | null>(null);

/**
 * Výběr souboru, fotoaparát a sdílení na Androidu pošlou aplikaci na
 * pozadí. Během nich se automatický zámek pozdrží, jinak by se aplikace
 * zamkla uprostřed nahrávání.
 */
let lockHolds = 0;
export async function withLockHold<T>(fn: () => Promise<T>): Promise<T> {
  lockHolds++;
  try {
    return await fn();
  } finally {
    // Událost „active“ přichází těsně před vyřešením slibu — chvíli počkat.
    setTimeout(() => {
      lockHolds = Math.max(0, lockHolds - 1);
    }, 1500);
  }
}

const auth = new AuthService(secureKeyStore, randomBytes);
const clock = { now: () => new Date() };

async function openData(dekHex: string): Promise<HcData> {
  const db = await openEncryptedDb(dekHex);
  return HcData.open(db, sandboxFiles, clock, newId);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [account, setAccount] = useState<Account | null>(null);
  const [data, setData] = useState<HcData | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [persons, setPersons] = useState<Person[]>([]);
  const [personId, setPersonId] = useState<Id | null>(null);
  const [version, setVersion] = useState(0);
  const [bio, setBio] = useState<BiometricInfo | null>(null);
  const [covered, setCovered] = useState(false);

  const dataRef = useRef<HcData | null>(null);
  const pendingDek = useRef<string | null>(null);
  const settingsRef = useRef(settings);
  const statusRef = useRef(status);
  useEffect(() => {
    settingsRef.current = settings;
    statusRef.current = status;
  }, [settings, status]);

  // Start: je v telefonu účet?
  useEffect(() => {
    (async () => {
      try {
        setBio(await biometricInfo());
      } catch {
        setBio({ available: false, enrolled: false, kind: 'generic', label: 'biometrie' });
      }
      const acc = await auth.account();
      setAccount(acc);
      setStatus(acc ? 'locked' : 'welcome');
    })();
  }, []);

  const loadAfterUnlock = useCallback(async (d: HcData, acc: Account) => {
    let self = await d.self();
    if (!self) self = await d.persons.create({ name: acc.name.split(/\s+/)[0] || acc.name, relation: 'self', isSelf: true, color: 0 });
    const [s, list] = await Promise.all([d.settings.get(), d.persons.list()]);
    const current = list.find((p) => p.id === s.lastPersonId) ?? self;
    dataRef.current = d;
    setData(d);
    setSettings(s);
    setPersons(list);
    setPersonId(current.id);
    setVersion((v) => v + 1);
    // Úklid souborů po smazaných záznamech — na pozadí, nic nečeká.
    d.files.collectGarbage().catch(() => {});
  }, []);

  const unlockWith = useCallback(
    async (dekHex: string) => {
      const acc = await auth.account();
      if (!acc) throw new Error('V tomto telefonu není žádný účet.');
      const d = await openData(dekHex);
      await loadAfterUnlock(d, acc);
      setAccount(acc);
      setStatus('unlocked');
    },
    [loadAfterUnlock],
  );

  const lock = useCallback(async () => {
    const d = dataRef.current;
    dataRef.current = null;
    pendingDek.current = null;
    // Všechno v jednom kroku: stav i data najednou, aby žádná obrazovka
    // nedostala „odemčeno“ bez dat. Databáze se zavře až potom.
    setStatus((s) => (s === 'welcome' ? s : 'locked'));
    setData(null);
    setPersons([]);
    setPersonId(null);
    if (d) await d.close().catch(() => {});
  }, []);

  // Zamčení po návratu z pozadí a zakrytí obsahu v přepínači aplikací.
  useEffect(() => {
    let backgroundAt: number | null = null;
    const sub = AppState.addEventListener('change', (st: AppStateStatus) => {
      if (st === 'active') {
        setCovered(false);
        if (backgroundAt != null && statusRef.current === 'unlocked' && lockHolds === 0) {
          const away = (Date.now() - backgroundAt) / 1000;
          if (away >= settingsRef.current.autoLockSeconds) lock();
        }
        backgroundAt = null;
      } else {
        if (statusRef.current === 'unlocked') setCovered(true);
        if (st === 'background' && backgroundAt == null) backgroundAt = Date.now();
      }
    });
    return () => sub.remove();
  }, [lock]);

  const value = useMemo<SessionValue>(() => {
    const person = persons.find((p) => p.id === personId) ?? persons[0] ?? null;
    const self = persons.find((p) => p.isSelf) ?? null;
    return {
      status, account, data, settings, persons, person, self, version, bio, covered, auth,

      async register(input) {
        const dek = await auth.register(input);
        const acc = (await auth.account())!;
        try {
          const d = await openData(dek);
          await loadAfterUnlock(d, acc);
        } catch (e) {
          // Bez databáze nemá účet smysl — vrátit do výchozího stavu.
          await auth.wipe();
          await deleteDb();
          throw e;
        }
        pendingDek.current = dek;
        setAccount(acc);
        setStatus('onboarding');
      },

      async finishOnboarding(enableBio) {
        const dek = pendingDek.current;
        pendingDek.current = null;
        if (enableBio && dek) {
          await auth.enableBiometric(dek);
          const d = dataRef.current;
          if (d) setSettings(await d.settings.set({ biometricEnabled: true }));
        }
        setStatus('unlocked');
      },

      async loginPassword(email, password) {
        const dek = await auth.login(email, password);
        await unlockWith(dek);
      },

      async loginBiometric() {
        const dek = await auth.unlockWithBiometric('Odemknout HumanCare');
        await unlockWith(dek);
      },

      lock,

      async wipeEverything() {
        await lock();
        await auth.wipe();
        await deleteDb();
        try {
          sandboxFiles.removeAll();
        } catch {
          // nic
        }
        setAccount(null);
        setSettings(DEFAULT_SETTINGS);
        setStatus('welcome');
      },

      async setPerson(id) {
        setPersonId(id);
        const d = dataRef.current;
        if (d) setSettings(await d.settings.set({ lastPersonId: id }));
      },

      touch() {
        setVersion((v) => v + 1);
      },

      async reloadPersons() {
        const d = dataRef.current;
        if (!d) return;
        const list = await d.persons.list();
        setPersons(list);
        if (!list.some((p) => p.id === personId)) setPersonId(list.find((p) => p.isSelf)?.id ?? list[0]?.id ?? null);
        setVersion((v) => v + 1);
      },

      async updateSettings(patch) {
        const d = dataRef.current;
        if (!d) return;
        setSettings(await d.settings.set(patch));
      },

      async enableBiometric(password) {
        const acc = await auth.account();
        if (!acc) throw new Error('V tomto telefonu není žádný účet.');
        const dek = await auth.login(acc.email, password);
        await auth.enableBiometric(dek);
        const d = dataRef.current;
        if (d) setSettings(await d.settings.set({ biometricEnabled: true }));
      },

      async disableBiometric() {
        await auth.disableBiometric();
        const d = dataRef.current;
        if (d) setSettings(await d.settings.set({ biometricEnabled: false }));
      },

      async changePassword(oldPw, newPw) {
        await auth.changePassword(oldPw, newPw);
      },

      async updateAccount(patch) {
        setAccount(await auth.updateAccount(patch));
      },
    };
  }, [status, account, data, settings, persons, personId, version, bio, covered, lock, unlockWith, loadAfterUnlock]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession mimo SessionProvider');
  return v;
}

/** Data odemknuté relace. Na obrazovkách za zámkem jsou vždy k dispozici. */
export function useData(): HcData {
  const { data } = useSession();
  if (!data) throw new Error('Data nejsou odemčená.');
  return data;
}

/** Aktuálně zobrazená karta (osoba). */
export function usePerson(): Person {
  const { person } = useSession();
  if (!person) throw new Error('Žádná karta.');
  return person;
}

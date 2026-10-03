import type { Account } from '@/domain/types';
import { KDF_DEFAULTS, bytesToHex, deriveKey, hexToBytes, open, seal, type KdfParams, type RandomBytes } from './crypto';

/**
 * Lokální účet a odemykání.
 *
 * Bezpečnostní model fáze 1 (jen telefon, žádný server):
 *  - Data jsou v SQLCipher databázi zašifrované náhodným klíčem (DEK).
 *  - DEK je uložený v Keychainu / Android Keystore dvakrát:
 *      1. zašifrovaný klíčem z hesla (scrypt) — vždy,
 *      2. volitelně holý, ale za biometrickou bránou OS (requireAuthentication).
 *  - Heslo se neukládá v žádné podobě.
 *  - Biometrie je jen rychlé odemknutí. Heslo zůstává jako záchrana a je
 *    potřeba ke změně hesla a k zapnutí biometrie.
 *  - Zapomenuté heslo bez biometrie = data nejdou otevřít. Jinak to u
 *    lokálního šifrování nejde; přihlašovací obrazovka to říká narovinu.
 */

export interface KeyStore {
  get(key: string, opts?: { requireAuthentication?: boolean; prompt?: string }): Promise<string | null>;
  set(key: string, value: string, opts?: { requireAuthentication?: boolean }): Promise<void>;
  delete(key: string, opts?: { requireAuthentication?: boolean }): Promise<void>;
}

interface Vault {
  v: 1;
  account: Account;
  kdf: KdfParams;
  /** DEK zašifrovaný klíčem z hesla */
  wrapped: string;
}

interface Throttle {
  failures: number;
  lockedUntil: number;
}

const K_VAULT = 'hc.vault.v1';
const K_BIO = 'hc.bio.dek.v1';
const K_THROTTLE = 'hc.throttle.v1';
/** Jen příznak „biometrie zapnutá“ — bez něj by přihlášení zbytečně vyvolávalo výzvu OS. */
const K_BIO_FLAG = 'hc.bio.on.v1';
const AAD = 'humancare-dek-v1';

export class AuthError extends Error {
  constructor(public code: 'no_account' | 'bad_credentials' | 'locked' | 'weak_password' | 'invalid' | 'bio_unavailable' | 'bio_failed', message: string, public retryAfterMs?: number) {
    super(message);
  }
}

export const MIN_PASSWORD = 8;

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Vrací text chyby nebo null. Pravidla jsou mírná, ale ne naivní. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Heslo musí mít aspoň ${MIN_PASSWORD} znaků.`;
  if (/^(.)\1+$/.test(pw)) return 'Heslo nesmí být jeden znak pořád dokola.';
  if (/^(12345678|123456789|password|heslo123|qwertyui)/i.test(pw)) return 'Tohle heslo je příliš běžné.';
  return null;
}

/** Prodleva po n-tém neúspěšném pokusu: od 5. pokusu 30 s, pak se zdvojuje, max 15 min. */
export function lockoutMs(failures: number): number {
  if (failures < 5) return 0;
  return Math.min(30_000 * 2 ** (failures - 5), 15 * 60_000);
}

export class AuthService {
  constructor(private store: KeyStore, private random: RandomBytes, private now: () => number = () => Date.now()) {}

  private async vault(): Promise<Vault | null> {
    const raw = await this.store.get(K_VAULT);
    if (!raw) return null;
    try {
      const v = JSON.parse(raw) as Vault;
      return v && v.v === 1 ? v : null;
    } catch {
      return null;
    }
  }

  async hasAccount(): Promise<boolean> {
    return (await this.vault()) != null;
  }

  async account(): Promise<Account | null> {
    return (await this.vault())?.account ?? null;
  }

  /** Vytvoří účet a vrátí klíč databáze (hex). */
  async register(input: { name: string; email: string; password: string }): Promise<string> {
    if (await this.hasAccount()) throw new AuthError('invalid', 'V tomto telefonu už účet je.');
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name) throw new AuthError('invalid', 'Vyplňte jméno.');
    if (!validateEmail(email)) throw new AuthError('invalid', 'E-mail nevypadá správně.');
    const problem = passwordProblem(input.password);
    if (problem) throw new AuthError('weak_password', problem);

    const dek = this.random(32);
    const kdf: KdfParams = { alg: 'scrypt', ...KDF_DEFAULTS, salt: bytesToHex(this.random(16)) };
    const kek = await deriveKey(input.password, kdf);
    const vault: Vault = {
      v: 1,
      account: { name, email, createdAt: new Date(this.now()).toISOString() },
      kdf,
      wrapped: seal(kek, dek, this.random, AAD),
    };
    await this.store.set(K_VAULT, JSON.stringify(vault));
    await this.store.delete(K_THROTTLE);
    return bytesToHex(dek);
  }

  private async throttle(): Promise<Throttle> {
    const raw = await this.store.get(K_THROTTLE);
    if (!raw) return { failures: 0, lockedUntil: 0 };
    try {
      return JSON.parse(raw) as Throttle;
    } catch {
      return { failures: 0, lockedUntil: 0 };
    }
  }

  /** Kolik ms ještě zbývá do dalšího pokusu (0 = může zkusit). */
  async retryAfter(): Promise<number> {
    const t = await this.throttle();
    return Math.max(0, t.lockedUntil - this.now());
  }

  /** Ověří e-mail a heslo, vrátí klíč databáze (hex). */
  async login(email: string, password: string): Promise<string> {
    const v = await this.vault();
    if (!v) throw new AuthError('no_account', 'V tomto telefonu není žádný účet.');
    const wait = await this.retryAfter();
    if (wait > 0) throw new AuthError('locked', 'Příliš mnoho pokusů.', wait);

    const emailOk = email.trim().toLowerCase() === v.account.email;
    let dek: Uint8Array | null = null;
    // Klíč se odvozuje i při špatném e-mailu — jinak by šlo podle doby
    // odezvy poznat, že e-mail nesedí.
    const kek = await deriveKey(password, v.kdf);
    try {
      dek = open(kek, v.wrapped, AAD);
    } catch {
      dek = null;
    }
    if (!emailOk || !dek) {
      const t = await this.throttle();
      const failures = t.failures + 1;
      const lock = lockoutMs(failures);
      await this.store.set(K_THROTTLE, JSON.stringify({ failures, lockedUntil: lock ? this.now() + lock : 0 }));
      throw new AuthError(lock ? 'locked' : 'bad_credentials', 'E-mail nebo heslo nesedí.', lock || undefined);
    }
    await this.store.delete(K_THROTTLE);
    return bytesToHex(dek);
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const v = await this.vault();
    if (!v) throw new AuthError('no_account', 'V tomto telefonu není žádný účet.');
    const problem = passwordProblem(newPassword);
    if (problem) throw new AuthError('weak_password', problem);
    let dek: Uint8Array;
    try {
      dek = open(await deriveKey(oldPassword, v.kdf), v.wrapped, AAD);
    } catch {
      throw new AuthError('bad_credentials', 'Současné heslo nesedí.');
    }
    const kdf: KdfParams = { alg: 'scrypt', ...KDF_DEFAULTS, salt: bytesToHex(this.random(16)) };
    const next: Vault = { ...v, kdf, wrapped: seal(await deriveKey(newPassword, kdf), dek, this.random, AAD) };
    await this.store.set(K_VAULT, JSON.stringify(next));
  }

  async updateAccount(patch: Partial<Pick<Account, 'name' | 'email'>>): Promise<Account> {
    const v = await this.vault();
    if (!v) throw new AuthError('no_account', 'V tomto telefonu není žádný účet.');
    const account = { ...v.account };
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new AuthError('invalid', 'Vyplňte jméno.');
      account.name = patch.name.trim();
    }
    if (patch.email !== undefined) {
      if (!validateEmail(patch.email)) throw new AuthError('invalid', 'E-mail nevypadá správně.');
      account.email = patch.email.trim().toLowerCase();
    }
    await this.store.set(K_VAULT, JSON.stringify({ ...v, account }));
    return account;
  }

  /** Uloží klíč databáze za biometrickou bránu OS. */
  async enableBiometric(dekHex: string): Promise<void> {
    hexToBytes(dekHex); // ověří formát
    await this.store.set(K_BIO, dekHex, { requireAuthentication: true });
    await this.store.set(K_BIO_FLAG, '1');
  }

  async biometricEnabled(): Promise<boolean> {
    return (await this.store.get(K_BIO_FLAG)) === '1';
  }

  async disableBiometric(): Promise<void> {
    await this.store.delete(K_BIO_FLAG);
    await this.store.delete(K_BIO, { requireAuthentication: true });
  }

  /** Vyvolá Face ID / Touch ID / otisk přes OS a vrátí klíč databáze. */
  async unlockWithBiometric(prompt: string): Promise<string> {
    let dek: string | null;
    try {
      dek = await this.store.get(K_BIO, { requireAuthentication: true, prompt });
    } catch {
      throw new AuthError('bio_failed', 'Odemknutí se nepovedlo.');
    }
    if (!dek) {
      // Klíč zmizel (např. po změně otisků v telefonu systém klíč zneplatní).
      await this.store.delete(K_BIO_FLAG);
      throw new AuthError('bio_unavailable', 'Biometrické odemykání není nastavené.');
    }
    return dek;
  }

  /** Smaže účet z Keychainu/Keystore. Databázi a soubory maže volající. */
  async wipe(): Promise<void> {
    await this.store.delete(K_VAULT);
    await this.store.delete(K_THROTTLE);
    await this.store.delete(K_BIO_FLAG);
    try {
      await this.store.delete(K_BIO, { requireAuthentication: true });
    } catch {
      // nebyla nastavená
    }
  }
}

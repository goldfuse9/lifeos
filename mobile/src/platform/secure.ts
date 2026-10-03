import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { KeyStore } from '@/services/auth';

/**
 * Keychain (iOS) / Keystore (Android) přes expo-secure-store.
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY: čitelné jen s odemčeným telefonem a nikdy
 * se nepřenese do zálohy ani na jiné zařízení.
 */
const BASE: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureKeyStore: KeyStore = {
  async get(key, opts) {
    return SecureStore.getItemAsync(key, {
      ...BASE,
      requireAuthentication: !!opts?.requireAuthentication,
      ...(opts?.prompt ? { authenticationPrompt: opts.prompt } : {}),
    });
  },
  async set(key, value, opts) {
    await SecureStore.setItemAsync(key, value, { ...BASE, requireAuthentication: !!opts?.requireAuthentication });
  },
  async delete(key, opts) {
    await SecureStore.deleteItemAsync(key, { ...BASE, requireAuthentication: !!opts?.requireAuthentication });
  },
};

export const randomBytes = (n: number): Uint8Array => Crypto.getRandomBytes(n);
export const newId = (): string => Crypto.randomUUID();

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'generic';

export interface BiometricInfo {
  available: boolean;
  enrolled: boolean;
  kind: BiometricKind;
  /** „Face ID“, „Touch ID“, „otisk prstu“… */
  label: string;
}

export async function biometricInfo(): Promise<BiometricInfo> {
  const [hw, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const T = LocalAuthentication.AuthenticationType;
  let kind: BiometricKind = 'generic';
  let label = 'biometrie';
  if (types.includes(T.FACIAL_RECOGNITION)) {
    kind = 'face';
    label = Platform.OS === 'ios' ? 'Face ID' : 'odemknutí obličejem';
  } else if (types.includes(T.FINGERPRINT)) {
    kind = 'fingerprint';
    label = Platform.OS === 'ios' ? 'Touch ID' : 'otisk prstu';
  } else if (types.includes(T.IRIS)) {
    kind = 'iris';
    label = 'sken duhovky';
  }
  return { available: hw && SecureStore.canUseBiometricAuthentication(), enrolled, kind, label };
}

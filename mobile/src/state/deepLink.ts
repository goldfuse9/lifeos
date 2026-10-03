import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import type { Status } from './session';

/**
 * Odkazy z widgetu (lifeos://zapis, lifeos://zaznam/upravit) vedou za
 * zámek. Když aplikace není odemčená, odkaz se zapamatuje a otevře se
 * hned po odemknutí. Povolené jsou jen obrazovky pro nový zápis.
 */
const ALLOWED = new Set(['zapis', 'zaznam/upravit', 'cyklus/zapis', 'leky']);

export function parseLink(url: string): string | null {
  const m = /^lifeos:\/\/\/?([^?#]*)(\?[^#]*)?/.exec(url);
  if (!m) return null;
  const path = m[1].replace(/\/+$/, '');
  if (!ALLOWED.has(path)) return null;
  // URLSearchParams v React Native neumí všechno — ručně.
  const mood = /[?&]mood=([0-4])(?:&|$)/.exec(m[2] ?? '')?.[1];
  const keep = mood ? `?mood=${mood}` : '';
  return `/${path}${keep}`;
}

export function usePendingLink(status: Status): void {
  const pending = useRef<string | null>(null);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
    if (status === 'unlocked' && pending.current) {
      const href = pending.current;
      pending.current = null;
      // Až se po odemknutí vykreslí Přehled.
      setTimeout(() => router.push(href as never), 350);
    }
  }, [status]);

  useEffect(() => {
    const take = (url: string | null) => {
      const href = url ? parseLink(url) : null;
      if (!href) return;
      pending.current = href;
      // Odemčeno: otevře ho router sám. Kdyby se ale vzápětí zamklo
      // (návrat z pozadí), zůstane odkaz čekat na odemknutí.
      if (statusRef.current === 'unlocked') {
        setTimeout(() => {
          if (statusRef.current === 'unlocked' && pending.current === href) pending.current = null;
        }, 1500);
      }
    };
    Linking.getInitialURL().then(take).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => take(e.url));
    return () => sub.remove();
  }, []);
}

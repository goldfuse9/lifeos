import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from './session';

/**
 * Načte data a načte je znovu, když se něco uloží (session.version)
 * nebo když se obrazovka vrátí do popředí. Jednodušší než cache knihovna
 * a pro lokální databázi stačí — dotazy trvají milisekundy.
 *
 * `deps` jsou hodnoty, na kterých dotaz závisí (id karty, filtr…). Musí
 * jít převést na JSON.
 */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]): { value: T | undefined; loading: boolean; error: Error | null; reload: () => void } {
  const { version, data } = useSession();
  const [value, setValue] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const seq = useRef(0);
  const loaderRef = useRef(loader);
  useLayoutEffect(() => {
    loaderRef.current = loader;
  });
  const depKey = JSON.stringify(deps);

  const run = useCallback(() => {
    if (!data) return;
    const my = ++seq.current;
    setLoading(true);
    loaderRef
      .current()
      .then((v) => {
        if (my === seq.current) {
          setValue(v);
          setError(null);
        }
      })
      .catch((e) => {
        if (my === seq.current) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (my === seq.current) setLoading(false);
      });
    // depKey a version jsou spouštěče — dotaz sám je v loaderRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, version, depKey]);

  // Běží při zobrazení obrazovky i při každé změně závislostí, dokud je vidět.
  useFocusEffect(
    useCallback(() => {
      run();
    }, [run]),
  );

  return { value, loading, error, reload: run };
}

/** Aktuální datum a čas; přepočítá se každou půlminutu, aby „Teď“ v ose nestálo. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

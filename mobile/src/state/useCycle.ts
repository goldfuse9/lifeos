import { useData, usePerson, useSession } from './session';
import { useLoad, useNow } from './useLoad';
import { computeCycle, type CycleInfo, type CycleSettings } from '@/domain/cycle';
import { toLocalDate } from '@/domain/dates';
import type { HcRecord, PersonalData } from '@/domain/types';

/**
 * Stav cyklu aktuální karty: nastavení, zápisy a výpočet.
 *
 * Starší verze měla jen globální přepínač „Sledovat cyklus“ pro vlastní
 * kartu — pokud je zapnutý a karta ještě nemá vlastní nastavení, bere
 * se jako zapnuté.
 */
export function useCycle(): {
  settings: CycleSettings;
  info: CycleInfo | null;
  records: HcRecord[];
  personal: PersonalData;
  /** Nabídnout sledování cyklu (žena / jiné pohlaví a ještě není zapnuté). */
  suggest: boolean;
  loading: boolean;
} {
  const data = useData();
  const person = usePerson();
  const { settings: app, self } = useSession();
  const today = toLocalDate(useNow());

  const { value, loading } = useLoad(async () => {
    const [stored, personal, records] = await Promise.all([
      data.personData.get(person.id, 'cycle'),
      data.personData.get(person.id, 'personal'),
      data.records.query({ personId: person.id, types: ['cycle'], order: 'asc' }),
    ]);
    const legacy = self?.id === person.id && app.cycleTracking && stored.enabled === undefined;
    const settings: CycleSettings = legacy ? { ...stored, enabled: true } : stored;
    return { settings, personal, records };
  }, [person.id, app.cycleTracking, self?.id]);

  const settings = value?.settings ?? {};
  const records = value?.records ?? [];
  const personal = value?.personal ?? {};
  const info = value ? computeCycle(settings, records, today) : null;
  const suggest = !settings.enabled && (personal.sex === 'žena' || personal.sex === 'jiné');
  return { settings, info, records, personal, suggest, loading };
}

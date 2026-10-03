import { useData, usePerson } from './session';
import { useLoad } from './useLoad';
import type { Med, MedLog } from '@/domain/meds';

/** Léky aktuální karty a log odškrtnutých dávek. */
export function useMeds(): { meds: Med[]; log: MedLog; loading: boolean } {
  const data = useData();
  const person = usePerson();
  const { value, loading } = useLoad(async () => {
    const [m, log] = await Promise.all([data.personData.get(person.id, 'meds'), data.personData.get(person.id, 'medlog')]);
    return { meds: m.list ?? [], log };
  }, [person.id]);
  return { meds: value?.meds ?? [], log: value?.log ?? {}, loading: loading && !value };
}

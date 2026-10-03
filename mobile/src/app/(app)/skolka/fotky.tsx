import React, { useEffect } from 'react';
import { View } from 'react-native';
import { usePerson } from '@/state/session';
import { useSkolka } from '@/state/useSkolka';
import { numericDate } from '@/domain/dates';
import { Card, T } from '@/ui/kit';
import { SkolkaScreen } from '@/ui/SkolkaScreen';
import { C } from '@/ui/theme';

/**
 * Fotky ze školky po albech. Fotky zůstávají u školky; v ukázce jsou
 * místo nich jen barevné náhledy. Otevřením se alba označí jako viděná.
 */
export default function SkolkaFotky() {
  const person = usePerson();
  const { value, saveFeed } = useSkolka();
  const unseen = value?.feed.alba?.some((a) => !a.seen);

  useEffect(() => {
    if (!value || !unseen) return;
    saveFeed({ ...value.feed, alba: (value.feed.alba ?? []).map((a) => ({ ...a, seen: true })) });
    // Jen jednou po načtení — označit jako viděné.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseen]);

  if (!value) return <SkolkaScreen title="Fotky" loading />;
  const { sk, feed } = value;
  const alba = [...(feed.alba ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <SkolkaScreen title="Fotky" sub={sk.trida ? 'Alba třídy ' + sk.trida : 'Alba ze školky'} demo={feed.demo}>
      {alba.length ? (
        <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10, rowGap: 14 }}>
          {alba.map((a) => (
            <View key={a.id} style={{ width: '48%', flexGrow: 1 }}>
              <View style={{ height: 150, borderRadius: 22, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', gap: 2, borderWidth: 1, borderColor: 'rgba(23,22,26,0.05)' }}>
                {a.colors.slice(0, 4).map((c, i) => (
                  <View key={i} style={{ width: '49.3%', height: 74, backgroundColor: c, alignItems: 'flex-end', justifyContent: 'flex-end', padding: 6 }}>
                    {i === 3 && a.count > 4 ? <T w="semibold" style={{ fontSize: 13, color: 'rgba(23,22,26,0.55)' }}>+{a.count - 3}</T> : null}
                  </View>
                ))}
              </View>
              <T w="semibold" style={{ marginTop: 8, fontSize: 15, lineHeight: 20 }}>{a.title}</T>
              <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{numericDate(a.date)} · {a.count} fotek</T>
            </View>
          ))}
        </View>
      ) : (
        <Card style={{ marginTop: 16, padding: 16, borderRadius: 22 }}>
          <T style={{ fontSize: 14, lineHeight: 20, color: C.muted }}>Zatím žádné album.</T>
        </Card>
      )}
      <View style={{ marginTop: 20, padding: 14, borderRadius: 22, backgroundColor: 'rgba(59,111,224,0.07)', borderWidth: 1, borderColor: 'rgba(59,111,224,0.16)' }}>
        <T w="semibold" style={{ fontSize: 14, lineHeight: 20, color: '#27407A' }}>Fotky zůstávají ve školce</T>
        <T style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: '#27407A' }}>Do telefonu se uloží jen ty, které si vyberete — do Dokumentů na kartě {person.name}.</T>
      </View>
    </SkolkaScreen>
  );
}

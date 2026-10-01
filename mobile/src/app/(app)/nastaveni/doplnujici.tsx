import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useCycle } from '@/state/useCycle';
import type { CycleSettings } from '@/domain/cycle';
import { Backdrop, Card, Divider, Loading, Note, Row, Segmented, T, ToggleRow, TopBar, useToast } from '@/ui/kit';
import { CY } from '@/ui/cycleViz';
import { C } from '@/ui/theme';
import { TypeGlyph } from '@/ui/icons';

/**
 * Doplňující údaje a předvolby — podle desky. Cyklus a těhotenství se
 * zapínají tady jako volba, ne odvozeně z pohlaví.
 */
export default function Doplnujici() {
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const { settings, info, loading } = useCycle();

  if (loading && !info) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <Loading />
      </View>
    );
  }

  const on = !!settings.enabled;
  const mode = settings.mode ?? 'cyklus';

  const save = async (patch: Partial<CycleSettings>, msg: string) => {
    await data.personData.set(person.id, 'cycle', { ...settings, ...patch });
    touch();
    toast(msg);
  };

  const toggle = async (v: boolean) => {
    if (v && settings.cycleLength == null) {
      // Ještě nikdy nenastaveno — tři údaje na stránce Cyklus.
      router.back();
      router.push('/cyklus');
      return;
    }
    await save({ enabled: v }, v ? 'Sledování zapnuto' : 'Sledování vypnuto · zápisy v ose zůstanou');
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title="Doplňující údaje" backLabel="Zpět do nastavení" />

        <T w="semibold" style={{ marginTop: 22, paddingHorizontal: 4, fontSize: 11, lineHeight: 15, color: C.muted, letterSpacing: 0.9, textTransform: 'uppercase' }}>Předvolby</T>
        <Card white style={{ marginTop: 8, overflow: 'hidden', borderRadius: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: CY.pinkTint, alignItems: 'center', justifyContent: 'center' }}>
              <TypeGlyph type="cycle" size={18} color="#8A1E4A" />
            </View>
            <View style={{ flex: 1 }}>
              <ToggleRow title="Cyklus a těhotenství" sub={on ? (mode === 'těhotenství' ? 'Těhotenství zapnuto' : 'Cyklus zapnutý') : 'Vypnuto'} value={on} onChange={toggle} />
            </View>
          </View>
          {on ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              <Segmented
                label="Režim"
                options={[['cyklus', 'Cyklus'], ['těhotenství', 'Těhotenství']]}
                value={mode}
                onChange={(v) => save({ mode: v }, v === 'těhotenství' ? 'Těhotenství · odhady menstruace pozastavené' : 'Sledování cyklu')}
              />
            </View>
          ) : null}
          {on ? (
            <>
              <Divider />
              <Row
                title="Otevřít Cyklus"
                sub="Kruh, zápisy, historie"
                onPress={() => {
                  router.back();
                  router.push('/cyklus');
                }}
              />
            </>
          ) : null}
        </Card>

        <Note style={{ marginTop: 14 }}>
          Zvláštní kategorie údajů. Je jen v tomto telefonu, zašifrovaná, a není na nouzové kartě.
        </Note>
      </ScrollView>
    </View>
  );
}

import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { usePerson } from '@/state/session';
import { useTodo } from '@/state/useTodo';
import { Backdrop, Card, Divider, H1, Loading, Muted, Row, T, TopBar, useScreenInsets } from '@/ui/kit';
import { C } from '@/ui/theme';
import { IconHeart } from '@/ui/icons';

/** Srdce na Přehledu — co z ostatních oddílů je potřeba vyřešit. */
export default function KReseni() {
  const ins = useScreenInsets();
  const person = usePerson();
  const { items, loading } = useTodo();

  const areas = [...new Set(items.map((i) => i.area))];

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} backLabel="Zpět na přehled" />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>K vyřešení</H1>
          <Muted style={{ marginTop: 4 }}>{items.length ? `${items.length} ${items.length === 1 ? 'věc' : items.length < 5 ? 'věci' : 'věcí'} z prevence, očkování, léků a dalších` : 'Co bude potřeba udělat, se objeví tady'}</Muted>
        </View>

        {loading ? <Loading /> : null}

        {!loading && !items.length ? (
          <Card style={{ marginTop: 16, padding: 24, alignItems: 'center', gap: 10 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FCE4EE', alignItems: 'center', justifyContent: 'center' }}>
              <IconHeart size={26} color="#E0457B" width={1.8} />
            </View>
            <T w="semibold" style={{ fontSize: 17 }}>Všechno v pořádku</T>
            <Muted style={{ textAlign: 'center' }}>Žádné prohlídky, očkování ani léky teď nečekají.</Muted>
          </Card>
        ) : null}

        {areas.map((a) => (
          <View key={a} style={{ marginTop: 20 }}>
            <T w="semibold" style={{ paddingHorizontal: 4, marginBottom: 8, fontSize: 13, color: C.muted }}>{a}</T>
            <Card style={{ overflow: 'hidden', borderRadius: 22 }}>
              {items
                .filter((i) => i.area === a)
                .map((i, n) => (
                  <View key={i.key}>
                    {n ? <Divider /> : null}
                    <Row title={i.title} sub={i.sub} warn={i.tone === 'warn'} dot={i.tone === 'warn' ? C.orange : '#3B6FE0'} onPress={() => router.push(i.href as never)} />
                  </View>
                ))}
            </Card>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

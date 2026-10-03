import React from 'react';
import { ScrollView, View } from 'react-native';
import { usePerson } from '@/state/session';
import { Backdrop, Badge, BottomFade, H1, Loading, Muted, T, TopBar, useScreenInsets } from './kit';
import { C } from './theme';

/** Podstránka školky: hlavička, nadpis a obsah — stejně jako ostatní oddíly. */
export function SkolkaScreen({ title, sub, demo, loading, children }: { title: string; sub?: string; demo?: boolean; loading?: boolean; children?: React.ReactNode }) {
  const ins = useScreenInsets();
  const person = usePerson();
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} backLabel="Školka" />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <H1>{title}</H1>
            {demo ? <Badge label="Ukázka" /> : null}
          </View>
          {sub ? <Muted style={{ marginTop: 2 }}>{sub}</Muted> : null}
        </View>
        {loading ? <Loading /> : children}
      </ScrollView>
      <BottomFade />
    </View>
  );
}

export function SkLabel({ children }: { children: React.ReactNode }) {
  return <T w="semibold" style={{ marginTop: 22, marginBottom: 8, marginLeft: 8, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: C.muted }}>{children}</T>;
}

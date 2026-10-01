import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSession } from '@/state/session';
import type { AppSettings } from '@/domain/types';
import { Backdrop, Card, H1, Muted, T, TopBar } from '@/ui/kit';
import { C, uiFor } from '@/ui/theme';
import { IconCheck } from '@/ui/icons';

/** Vzhled — přepínače, které na plátně byly v panelu „Vzhled“. */
const BGS: AppSettings['background'][] = ['čiré sklo', 'teplé sklo', 'chladné sklo', 'bílé'];

export default function Vzhled() {
  const s = useSession();
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>Vzhled</H1>
        <Muted style={{ paddingLeft: 8, marginTop: 4 }}>Pozadí a barva tlačítka s vašimi iniciálami.</Muted>

        <T w="semibold" style={{ marginTop: 20, paddingHorizontal: 4, fontSize: 12, color: C.muted }}>Pozadí</T>
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {BGS.map((b) => {
            const ui = uiFor(b);
            const on = s.settings.background === b;
            return (
              <Pressable key={b} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={b} onPress={() => s.updateSettings({ background: b })} style={{ width: '48%', height: 96, borderRadius: 22, backgroundColor: ui.bg, borderWidth: 2, borderColor: on ? C.ink : C.line, padding: 12, justifyContent: 'flex-end', overflow: 'hidden' }}>
                <View style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: 45, backgroundColor: ui.blobs[0] }} />
                <View style={{ position: 'absolute', bottom: -30, left: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: ui.blobs[1] }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T w="semibold" style={{ fontSize: 14 }}>{b.charAt(0).toUpperCase() + b.slice(1)}</T>
                  {on ? <IconCheck size={18} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <T w="semibold" style={{ marginTop: 24, paddingHorizontal: 4, fontSize: 12, color: C.muted }}>Tlačítko „já“</T>
        <Card style={{ marginTop: 8, padding: 14, flexDirection: 'row', gap: 16 }}>
          {(['limetková', 'černá'] as const).map((a) => {
            const on = s.settings.avatarStyle === a;
            return (
              <Pressable key={a} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={a} onPress={() => s.updateSettings({ avatarStyle: a })} style={{ alignItems: 'center', gap: 6 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: a === 'černá' ? C.ink : C.lime, borderWidth: 3, borderColor: on ? C.orange : 'transparent' }} />
                <T w={on ? 'semibold' : 'regular'} style={{ fontSize: 13 }}>{a.charAt(0).toUpperCase() + a.slice(1)}</T>
              </Pressable>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}

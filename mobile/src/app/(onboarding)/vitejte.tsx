import React from 'react';
import { ScrollView, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSession } from '@/state/session';
import { Backdrop, Card, H1, Muted, PrimaryButton, SecondaryButton, T, useScreenInsets } from '@/ui/kit';
import { Wordmark } from '@/ui/Wordmark';
import { C } from '@/ui/theme';
import { IconLock, IconShield, TypeGlyph } from '@/ui/icons';

/** První spuštění. */
export default function Welcome() {
  const { status } = useSession();
  const ins = useScreenInsets();
  if (status === 'onboarding') return <Redirect href="/register" />;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 }}>
        <View style={{ height: 44, justifyContent: 'center', paddingLeft: 6 }}>
          <Wordmark />
        </View>
        <View style={{ marginTop: 40, paddingHorizontal: 8 }}>
          <H1 style={{ fontSize: 34, lineHeight: 40 }}>Zdraví celé rodiny na jednom místě</H1>
          <Muted style={{ marginTop: 10, fontSize: 16, lineHeight: 24 }}>
            Časová osa, kalendář, dokumenty a nouzová karta — pro vás i pro děti.
          </Muted>
        </View>

        <Card style={{ marginTop: 28, padding: 16, gap: 16 }}>
          <Point icon={<TypeGlyph type="event" color="#F7931E" />} tint="#FFF1E0" title="Zápis za pár vteřin" text="Návštěva, lék, příznak nebo fotka zprávy." />
          <Point icon={<IconLock size={16} color="#3B6FE0" width={1.8} />} tint="#E8EFFD" title="Jen v tomto telefonu" text="Žádný server. Data jsou zašifrovaná a odemykáte je heslem nebo Face ID." />
          <Point icon={<IconShield size={16} color="#9B3FE0" width={1.8} />} tint="#F3E9FD" title="Funguje i bez signálu" text="V letadle, v čekárně, kdekoli." />
        </Card>

        <View style={{ flex: 1 }} />
        <View style={{ marginTop: 28, gap: 12 }}>
          <PrimaryButton label="Vytvořit účet" onPress={() => router.push('/register')} />
          <SecondaryButton label="Obnovit ze zálohy" onPress={() => router.push('/obnovit')} />
          <T style={{ textAlign: 'center', fontSize: 13, lineHeight: 18, color: C.muted }}>
            Prototyp. Nic se nesynchronizuje — data chrání záloha, kterou si vytvoříte v nastavení.
          </T>
        </View>
      </ScrollView>
    </View>
  );
}

function Point({ icon, tint, title, text }: { icon: React.ReactNode; tint: string; title: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{title}</T>
        <Muted style={{ fontSize: 13, lineHeight: 18 }}>{text}</Muted>
      </View>
    </View>
  );
}

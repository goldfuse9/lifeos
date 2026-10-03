import React from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { usePerson, useSession } from '@/state/session';
import { useNow } from '@/state/useLoad';
import { useSkolka } from '@/state/useSkolka';
import { smsUrl, zpravaOf, zpravaSummary } from '@/domain/skolka';
import { numericDate, relativeDays, toLocalDate } from '@/domain/dates';
import { Badge, Card, Divider, Muted, PrimaryButton, T, useToast } from '@/ui/kit';
import { SkLabel as Label, SkolkaScreen } from '@/ui/SkolkaScreen';
import { C } from '@/ui/theme';
import { IconFile, IconThermo } from '@/ui/icons';

/** Zprávy: nahoře co přišlo pro dítě (zápisy učitelky), pod tím nástěnka třídy. */
export default function SkolkaZpravy() {
  const person = usePerson();
  const { account } = useSession();
  const toast = useToast();
  const today = toLocalDate(useNow());
  const { value } = useSkolka();
  if (!value) return <SkolkaScreen title="Zprávy" loading />;

  const { sk, feed, school } = value;
  const mine = school.filter((r) => zpravaOf(r));
  const board = [...(feed.nastenka ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const write = () => {
    if (!sk.phone) return toast('Doplňte telefon školky v nastavení');
    const podpis = account?.name.split(/\s+/)[0];
    Linking.openURL(smsUrl(sk.phone, 'Dobrý den, ' + (podpis ? `\n\n${podpis}` : ''), Platform.OS === 'ios'));
  };

  return (
    <SkolkaScreen title="Zprávy" sub="Od učitelek a z nástěnky třídy" demo={feed.demo}>
      <Label>Pro {person.name}</Label>
      <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
        {mine.length ? (
          mine.map((r, i) => {
            const z = zpravaOf(r)!;
            return (
              <View key={r.id}>
                {i ? <Divider /> : null}
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/skolka/zprava', params: { id: r.id } })} style={({ pressed }) => ({ padding: 14, flexDirection: 'row', gap: 12, backgroundColor: pressed ? 'rgba(255,255,255,0.6)' : 'transparent' })}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.orangeTint, alignItems: 'center', justifyContent: 'center' }}>
                    <IconThermo size={20} color={C.orangeInk} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Zápis dne</T>
                      <T style={{ fontSize: 13, color: C.muted }}>{relativeDays(r.date, today)}{r.time ? ' ' + r.time.replace(/^0/, '') : ''}</T>
                    </View>
                    <T style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: C.ink2 }}>{zpravaSummary(z)}</T>
                    <View style={{ marginTop: 8, flexDirection: 'row', gap: 6 }}>
                      {!z.ackAt ? <Badge label="Nové" bg={C.orangeTint} fg={C.orangeInk} /> : null}
                      <Badge label={z.from} />
                    </View>
                  </View>
                </Pressable>
              </View>
            );
          })
        ) : (
          <T style={{ padding: 14, fontSize: 14, lineHeight: 20, color: C.muted }}>Zatím žádná zpráva.</T>
        )}
      </Card>

      <Label>Nástěnka třídy</Label>
      <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
        {board.length ? (
          board.map((n, i) => (
            <View key={n.id}>
              {i ? <Divider /> : null}
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T w="semibold" style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>{n.title}</T>
                  <T style={{ fontSize: 13, color: C.muted }}>{numericDate(n.date)}</T>
                </View>
                <T style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: C.ink2 }}>{n.text}</T>
                {n.file ? (
                  <View style={{ marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: C.chip }}>
                    <IconFile size={14} color={C.ink2} />
                    <T w="semibold" style={{ fontSize: 13 }}>{n.file}</T>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <T style={{ padding: 14, fontSize: 14, lineHeight: 20, color: C.muted }}>Nástěnka je prázdná.</T>
        )}
      </Card>

      <PrimaryButton style={{ marginTop: 16 }} label="Napsat učitelce" onPress={write} />
      <Muted style={{ marginTop: 12, paddingHorizontal: 8, fontSize: 12, lineHeight: 17 }}>Zpráva odejde jako SMS na telefon školky.</Muted>
    </SkolkaScreen>
  );
}


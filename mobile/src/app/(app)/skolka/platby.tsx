import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import { toQR } from 'toqr';
import { usePerson } from '@/state/session';
import { useSkolka } from '@/state/useSkolka';
import { czIban, czk, spayd, unpaid, type Platba } from '@/domain/skolkaFeed';
import { numericDate } from '@/domain/dates';
import { Card, Divider, Muted, PrimaryButton, SecondaryButton, T, useToast } from '@/ui/kit';
import { SkLabel, SkolkaScreen } from '@/ui/SkolkaScreen';
import { C } from '@/ui/theme';
import { IconCheck } from '@/ui/icons';

/**
 * Platby školce. QR kód se skládá v telefonu z účtu a variabilního symbolu,
 * které rodič zadá v nastavení školky (formát QR Platba, který čtou české
 * banky). Bez platného účtu se QR neukáže — nic se nedomýšlí.
 */
export default function SkolkaPlatby() {
  const person = usePerson();
  const toast = useToast();
  const { value, saveFeed } = useSkolka();
  if (!value) return <SkolkaScreen title="Platby" loading />;

  const { sk, feed } = value;
  const open = unpaid(feed);
  const paid = (feed.platby ?? []).filter((p) => p.paidAt).sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''));
  const iban = sk.ucet ? czIban(sk.ucet) : null;

  const markPaid = async (p: Platba) => {
    await saveFeed({ ...feed, platby: (feed.platby ?? []).map((x) => (x.id === p.id ? { ...x, paidAt: new Date().toISOString() } : x)) });
    toast('Označeno jako zaplacené');
  };

  return (
    <SkolkaScreen title="Platby" sub="Stravné, školné a akce" demo={feed.demo}>
      {open.map((p) => (
        <Card key={p.id} style={{ marginTop: 16, padding: 16, borderRadius: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <T w="semibold" style={{ fontSize: 17, lineHeight: 22 }}>{p.title}</T>
              <T w="semibold" style={{ fontSize: 13, lineHeight: 18, color: C.orangeInk }}>Splatné do {numericDate(p.due)}</T>
            </View>
            <T w="semibold" style={{ fontSize: 22, fontVariant: ['tabular-nums'] }}>{czk(p.amount)}</T>
          </View>
          {iban ? (
            <View style={{ marginTop: 14, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <Qr text={spayd({ iban, amount: p.amount, vs: sk.vs, msg: p.title + ' ' + person.name })} size={132} />
              <View style={{ flex: 1, gap: 4 }}>
                <Kv k="Účet" v={sk.ucet!} />
                {sk.vs ? <Kv k="VS" v={sk.vs} /> : null}
                <Kv k="Zpráva" v={person.name} />
              </View>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => router.push('/skolka/nastavit')} style={{ marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: 'rgba(59,111,224,0.07)' }}>
              <T style={{ fontSize: 13, lineHeight: 18, color: '#27407A' }}>
                Doplňte účet školky a variabilní symbol — ukážu QR kód pro bankovní aplikaci. <T w="semibold" style={{ fontSize: 13, color: '#27407A', textDecorationLine: 'underline' }}>Doplnit</T>
              </T>
            </Pressable>
          )}
          {iban ? <T style={{ marginTop: 12, fontSize: 13, lineHeight: 18, color: C.muted }}>V bankovní aplikaci zvolte „QR platba“ a namiřte na kód.</T> : null}
          <SecondaryButton style={{ marginTop: 12 }} label="Už jsem zaplatil(a)" onPress={() => markPaid(p)} />
        </Card>
      ))}
      {!open.length ? (
        <Card style={{ marginTop: 16, padding: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconCheck size={18} color={C.ok} width={2.4} />
          <T w="semibold" style={{ fontSize: 15, color: '#125742' }}>{feed.platby?.length ? 'Vše zaplaceno' : 'Zatím žádná platba'}</T>
        </Card>
      ) : null}

      {paid.length ? (
        <>
          <SkLabel>Zaplaceno</SkLabel>
          <Card style={{ borderRadius: 22, overflow: 'hidden' }}>
            {paid.map((p, i) => (
              <View key={p.id}>
                {i ? <Divider /> : null}
                <View style={{ minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{p.title}</T>
                    <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{numericDate(p.paidAt!.slice(0, 10))}</T>
                  </View>
                  <T w="semibold" style={{ fontSize: 15, fontVariant: ['tabular-nums'] }}>{czk(p.amount)}</T>
                  <IconCheck size={18} color={C.ok} width={2.4} />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Muted style={{ marginTop: 14, paddingHorizontal: 8, fontSize: 12, lineHeight: 17 }}>Nezaplacená platba svítí v srdci „K vyřešení“.</Muted>
      {open.length && !iban ? <PrimaryButton style={{ marginTop: 14 }} label="Doplnit účet školky" onPress={() => router.push('/skolka/nastavit')} /> : null}
    </SkolkaScreen>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <T style={{ fontSize: 13, color: C.muted }}>{k}</T>
      <T w="semibold" numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, fontVariant: ['tabular-nums'] }}>{v}</T>
    </View>
  );
}

/** QR kód jako jedna cesta v SVG (bez síťové služby). */
function Qr({ text, size }: { text: string; size: number }) {
  const { n, d } = useMemo(() => {
    const m = toQR(text);
    const n = Math.round(Math.sqrt(m.length));
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y * n + x]) d += `M${x} ${y}h1v1h-1z`;
    return { n, d };
  }, [text]);
  const q = 2; // tichá zóna
  return (
    <View accessibilityLabel="QR kód pro platbu" style={{ width: size, height: size, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
      <Svg width={size - 2} height={size - 2} viewBox={`${-q} ${-q} ${n + 2 * q} ${n + 2 * q}`}>
        <Rect x={-q} y={-q} width={n + 2 * q} height={n + 2 * q} fill="#FFFFFF" />
        <Path d={d} fill="#17161A" />
      </Svg>
    </View>
  );
}

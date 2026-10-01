import React, { useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import { useData, usePerson, useSession, withLockHold } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { extractPhone } from '@/domain/emergency';
import { medsForEmergency } from '@/domain/meds';
import { Backdrop, Card, Divider, H1, Loading, Muted, Note, PrimaryButton, T, ToggleRow, TopBar, useScreenInsets, useToast } from '@/ui/kit';
import { C } from '@/ui/theme';

/**
 * Nouzová karta na zamčenou obrazovku — obrázek, který si člověk nastaví
 * jako tapetu zámku. Nahoře volné místo pro hodiny, dole pro svítilnu.
 * Co na něm bude, vybírá člověk (vidí to každý, kdo vezme telefon do ruky).
 */
type Key = 'name' | 'allergies' | 'conditions' | 'meds' | 'blood' | 'ice';
const FIELDS: { k: Key; label: string; en: string; def: boolean }[] = [
  { k: 'name', label: 'Jméno', en: 'Name', def: true },
  { k: 'allergies', label: 'Alergie', en: 'Allergies', def: true },
  { k: 'conditions', label: 'Onemocnění', en: 'Conditions', def: false },
  { k: 'meds', label: 'Léky', en: 'Medication', def: false },
  { k: 'blood', label: 'Krevní skupina', en: 'Blood type', def: true },
  { k: 'ice', label: 'Kontakt', en: 'Emergency contact', def: true },
];

export default function Tapeta() {
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const { account, self } = useSession();
  const toast = useToast();
  const { width: W, height: H } = useWindowDimensions();
  const shot = useRef<View>(null);
  const [on, setOn] = useState<Record<Key, boolean>>(() => Object.fromEntries(FIELDS.map((f) => [f.k, f.def])) as Record<Key, boolean>);
  const [busy, setBusy] = useState(false);

  const { value } = useLoad(async () => {
    const [e, m, p] = await Promise.all([data.personData.get(person.id, 'emergency'), data.personData.get(person.id, 'meds'), data.personData.get(person.id, 'personal')]);
    const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || (self?.id === person.id ? account?.name : person.name) || person.name;
    const vals: Record<Key, string> = {
      name: fullName,
      allergies: e.allergies ?? '',
      conditions: e.conditions ?? '',
      meds: [medsForEmergency(m.list ?? []), e.meds].filter(Boolean).join('; '),
      blood: e.blood && e.blood !== 'nevím' ? e.blood : '',
      ice: e.ice ?? '',
    };
    return vals;
  }, [person.id]);

  if (!value) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <Loading />
      </View>
    );
  }

  const available = FIELDS.filter((f) => value[f.k]);
  const shown = available.filter((f) => on[f.k]);
  const scale = 0.62;

  const save = async () => {
    if (!shot.current) return;
    setBusy(true);
    try {
      const uri = await captureRef(shot, { format: 'png', quality: 1, result: 'tmpfile', fileName: 'LifeOS-nouzova-tapeta' });
      if (await Sharing.isAvailableAsync()) await withLockHold(() => Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Uložit obrázek' }));
      else toast('Sdílení není v tomto telefonu dostupné.');
    } catch {
      toast('Obrázek se nepodařilo vytvořit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Na zamčenou obrazovku</H1>
          <Muted style={{ marginTop: 4 }}>Obrázek jako tapeta zámku — záchranář ho uvidí bez odemčení.</Muted>
        </View>

        {available.length ? (
          <Card style={{ marginTop: 16, overflow: 'hidden', borderRadius: 24 }}>
            {available.map((f, i) => (
              <View key={f.k}>
                {i ? <Divider /> : null}
                <ToggleRow title={f.label} value={on[f.k]} onChange={(v) => setOn((o) => ({ ...o, [f.k]: v }))} />
              </View>
            ))}
          </Card>
        ) : (
          <Muted style={{ marginTop: 16, paddingHorizontal: 8 }}>Nejdřív vyplňte nouzové údaje — alergie, krevní skupinu, kontakt.</Muted>
        )}

        {/* Náhled — skutečná velikost obrazovky, zmenšená transformací */}
        <View style={{ marginTop: 20, alignItems: 'center', height: H * scale }}>
          <View style={{ width: W, height: H, transform: [{ scale }], marginTop: -(H * (1 - scale)) / 2, borderRadius: 48, overflow: 'hidden' }}>
            <View ref={shot} collapsable={false} style={{ width: W, height: H }}>
              <Wallpaper rows={shown.map((f) => ({ ...f, value: value[f.k] }))} W={W} H={H} />
            </View>
          </View>
        </View>

        <PrimaryButton style={{ marginTop: 20 }} label={busy ? 'Připravuji…' : 'Uložit obrázek'} onPress={save} busy={busy} disabled={!shown.length} />
        <Card style={{ marginTop: 12, padding: 16, gap: 6 }}>
          <T w="semibold" style={{ fontSize: 14 }}>Jak ho nastavit</T>
          <Muted style={{ fontSize: 13, lineHeight: 19 }}>1. Uložit obrázek → „Uložit obrázek“ do Fotek.{'\n'}2. Fotky → obrázek → Sdílet → „Použít jako tapetu“.{'\n'}3. Zvolit jen pro zamčenou obrazovku.</Muted>
        </Card>
        <Note style={{ marginTop: 16 }}>
          Obrázek uvidí každý, kdo vezme telefon do ruky — vyberte jen to, co má záchranář vědět. Spolehlivější je i Zdravotní ID v iPhonu (aplikace Zdraví → profil → Zdravotní ID → Zobrazit při zamčení); údaje z karty tam můžete opsat.
        </Note>
      </ScrollView>
    </View>
  );
}

function Wallpaper({ rows, W, H }: { rows: { k: Key; label: string; en: string; value: string }[]; W: number; H: number }) {
  const phone = extractPhone(rows.find((r) => r.k === 'ice')?.value);
  return (
    <LinearGradient colors={['#1D1C21', '#2E2D33', '#3A2A2E']} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={{ width: W, height: H, paddingHorizontal: 22 }}>
      {/* Hodiny zabírají horní ~40 % */}
      <View style={{ height: H * 0.42 }} />
      <View style={{ borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: '#D92D20', alignItems: 'center', justifyContent: 'center' }}>
            <T w="semibold" style={{ color: C.white, fontSize: 20, lineHeight: 22 }}>+</T>
          </View>
          <View>
            <T w="semibold" style={{ color: C.white, fontSize: 15, letterSpacing: 1.2 }}>NOUZOVÉ ÚDAJE</T>
            <T style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: 1 }}>IN CASE OF EMERGENCY</T>
          </View>
        </View>
        {rows.map((r) => (
          <View key={r.k} style={{ marginTop: 12 }}>
            <T style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: 0.6 }}>{r.label.toUpperCase() + ' · ' + r.en.toUpperCase()}</T>
            <T w="semibold" numberOfLines={r.k === 'meds' || r.k === 'conditions' ? 3 : 2} style={{ color: C.white, fontSize: r.k === 'name' ? 20 : 16, lineHeight: r.k === 'name' ? 25 : 21, marginTop: 2 }}>
              {r.value}
            </T>
          </View>
        ))}
        {phone ? <T style={{ marginTop: 12, color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Volejte: {phone} · Call: {phone}</T> : null}
      </View>
    </LinearGradient>
  );
}

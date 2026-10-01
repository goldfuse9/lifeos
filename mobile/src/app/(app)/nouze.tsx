import React from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { EMERGENCY_FIELDS, emergencyProgress, extractPhone } from '@/domain/emergency';
import { medsForEmergency } from '@/domain/meds';
import { tetanusYear } from '@/domain/vaccines';
import type { EmergencyData } from '@/domain/types';
import { Backdrop, BottomFade, Callout, Card, H1, Muted, Note, PrimaryButton, SecondaryButton, T, TopBar, useScreenInsets, useUi } from '@/ui/kit';
import { MeFab } from '@/ui/fabs';
import { C } from '@/ui/theme';
import { IconLock, IconPhone } from '@/ui/icons';

/**
 * Nouzová karta — Nouze.dc.html. Ukazuje uložené nouzové údaje.
 *
 * Kód pro záchranáře (QR s odpočtem) na plátně předpokládá server, který
 * kód ověří a otevření zaloguje. Bez něj by šlo jen o obrázek, který nic
 * nedělá — proto je místo něj poctivě označený jako budoucí funkce.
 */
export default function Nouze() {
  const ui = useUi();
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const { value: em } = useLoad(async () => {
    const [e, m, vax] = await Promise.all([data.personData.get(person.id, 'emergency'), data.personData.get(person.id, 'meds'), data.records.query({ personId: person.id, types: ['vaccine'] })]);
    // Léky ze seznamu Léky + to, co je ručně v nouzových údajích.
    const meds = [medsForEmergency(m.list ?? []), e.meds].filter(Boolean).join('; ');
    // Tetanus z Očkování, pokud není vyplněný ručně.
    return { ...e, meds: meds || undefined, tetanus: e.tetanus || tetanusYear(vax) || undefined };
  }, [person.id]);
  const e: EmergencyData = em ?? {};
  const { filled } = emergencyProgress(e);
  const rows = EMERGENCY_FIELDS.filter((f) => f.prio <= 2 || e[f.k]);
  const ice = extractPhone(e.ice);

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} backLabel="Zpět na přehled" />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Nouzová karta</H1>
          <Muted style={{ marginTop: 4 }}>Co potřebuje vědět záchranář. Ukažte mu telefon.</Muted>
        </View>

        <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
          <PrimaryButton tone="danger" style={{ flex: 1 }} label="Volat 155" onPress={() => Linking.openURL('tel:155')} />
          {ice ? <SecondaryButton style={{ flex: 1 }} label="Volat kontakt" icon={<IconPhone size={16} color={C.ink} width={1.8} />} onPress={() => Linking.openURL('tel:' + ice)} /> : null}
        </View>

        {filled === 0 ? (
          <Callout title="Karta je zatím prázdná" style={{ marginTop: 16 }}>
            Vyplňte aspoň alergie, nemoci a léky — to je to, co záchranář potřebuje nejdřív.
          </Callout>
        ) : null}

        <Card style={{ marginTop: 16, paddingHorizontal: 16, paddingVertical: 4 }}>
          {rows.map((f, i) => (
            <View key={f.k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, paddingVertical: 14, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: ui.rule }}>
              <T style={{ flexShrink: 0, maxWidth: '45%', fontSize: 14, lineHeight: 20, color: C.muted }}>{f.label}</T>
              <T w="semibold" selectable style={{ flex: 1, textAlign: 'right', fontSize: 14, lineHeight: 20, color: e[f.k] ? C.ink : C.faint }}>{e[f.k] || 'neuvedeno'}</T>
            </View>
          ))}
        </Card>

        <PrimaryButton style={{ marginTop: 16 }} label="Upravit nouzové údaje" onPress={() => router.push('/nastaveni/nouzove')} />
        <SecondaryButton style={{ marginTop: 10 }} label="Na zamčenou obrazovku" onPress={() => router.push('/tapeta')} />

        <Card style={{ marginTop: 16, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 36, height: 36, borderRadius: 13, backgroundColor: '#F1F0EE', alignItems: 'center', justifyContent: 'center' }}>
            <IconLock size={16} color={C.muted} width={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T w="semibold" style={{ fontSize: 15 }}>Kód pro záchranáře</T>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#F1F0EE' }}>
                <T w="semibold" style={{ fontSize: 11, color: C.muted }}>Připravujeme</T>
              </View>
            </View>
            <Muted style={{ fontSize: 13, lineHeight: 18, marginTop: 2 }}>
              Časově omezený kód, po jehož načtení uvidí záchranka jen tuhle kartu a vám přijde zpráva. Potřebuje online ověření, přijde v další fázi.
            </Muted>
          </View>
        </Card>

        <Note style={{ marginTop: 16 }}>Údaje jsou jen v tomto telefonu. Pro přístup bez odemčení si je opište i do zdravotního ID v nastavení telefonu.</Note>
      </ScrollView>
      <BottomFade />
      <MeFab label="Zpět na přehled" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
  );
}

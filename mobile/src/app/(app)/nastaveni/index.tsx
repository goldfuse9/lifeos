import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { useData, useSession, withLockHold } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { emergencyProgress } from '@/domain/emergency';
import { ageLabel, ageOn, toLocalDate } from '@/domain/dates';
import { buildExport } from '@/services/export';
import { cacheFile, removeCacheFile } from '@/platform/files';
import { Avatar, Backdrop, Card, Divider, H1, Muted, PillButton, Row, SecondaryButton, T, ToggleRow, useScreenInsets, useToast } from '@/ui/kit';
import { confirm } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconClose, IconPlus } from '@/ui/icons';

/**
 * „Já“ — účet, čí kartu zobrazit a nastavení. Struktura je převzatá
 * z panelu „Můj účet a nastavení“ na Přehledu. Položky, které potřebují
 * server, zůstávají vidět, ale jsou zřetelně označené „Připravujeme“.
 */

const REL: Record<string, string> = { self: 'Já', partner: 'Partner/ka', child: 'Dítě', parent: 'Rodič', other: 'Blízký' };

export default function Settings() {
  const s = useSession();
  const data = useData();
  const toast = useToast();
  const ins = useScreenInsets();
  const person = s.person!;
  const isSelf = !!s.self && s.self.id === person.id;
  const [exporting, setExporting] = useState(false);
  const today = toLocalDate(new Date());

  const { value } = useLoad(async () => {
    const [em, doctors] = await Promise.all([data.personData.get(person.id, 'emergency'), data.personData.get(person.id, 'doctors')]);
    return { em: emergencyProgress(em), doctors: doctors.list?.length ?? 0 };
  }, [person.id]);

  const doExport = async () => {
    const ok = await confirm(
      'Stáhnout všechna data?',
      'Vznikne soubor JSON se všemi kartami a záznamy (bez obsahu příloh). Soubor NENÍ zašifrovaný — ukládejte ho jen tam, kam patří zdravotní údaje.',
      'Pokračovat',
      false,
    );
    if (!ok) return;
    setExporting(true);
    const name = `humancare-export-${today}.json`;
    try {
      const json = await buildExport(data, s.account);
      const uri = cacheFile(name, json);
      if (await Sharing.isAvailableAsync()) await withLockHold(() => Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export HumanCare', UTI: 'public.json' }));
      else toast('Sdílení není v tomto telefonu dostupné.');
    } catch {
      toast('Export se nepovedl.');
    } finally {
      removeCacheFile(name);
      setExporting(false);
    }
  };

  const logout = async () => {
    await s.lock();
  };

  const soon = (what: string) => () => toast(what + ' přijde s online verzí.');

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 20 : ins.top, paddingHorizontal: 16, paddingBottom: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <H1 style={{ paddingLeft: 8 }}>Já</H1>
          <PillButton accessibilityRole="button" accessibilityLabel="Zavřít nastavení" onPress={() => router.back()}>
            <IconClose size={18} color={C.muted} />
          </PillButton>
        </View>

        <Card white style={{ marginTop: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={s.account?.name ?? ''} color={s.self?.color ?? 0} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T w="semibold" numberOfLines={1} style={{ fontSize: 18, lineHeight: 24, letterSpacing: -0.18 }}>{s.account?.name}</T>
            <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{s.account?.email}</T>
          </View>
        </Card>

        {/* Čí kartu zobrazit */}
        <View style={{ marginTop: 20, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
          <T w="semibold" style={{ fontSize: 12, color: C.muted }}>Čí kartu zobrazit</T>
          <T style={{ fontSize: 12, color: C.muted }}>{isSelf ? 'Vaše karta' : 'Karta: ' + person.name}</T>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {s.persons.map((p) => {
            const on = p.id === person.id;
            return (
              <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={'Karta: ' + p.name} onPress={() => { s.setPerson(p.id); toast('Karta: ' + p.name); }} style={{ width: 60, alignItems: 'center', gap: 4 }}>
                <View style={{ padding: 2, borderRadius: 22, borderWidth: 2, borderColor: on ? C.ink : 'transparent' }}>
                  <Avatar name={p.name} color={p.color} size={48} />
                </View>
                <T w={on ? 'semibold' : 'regular'} numberOfLines={1} style={{ fontSize: 12 }}>{p.isSelf ? 'Já' : p.name}</T>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" accessibilityLabel="Přidat kartu" onPress={() => router.push({ pathname: '/nastaveni/karta', params: { new: '1' } })} style={{ width: 60, alignItems: 'center', gap: 4 }}>
            <View style={{ width: 52, height: 52, margin: 2, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9C7CC', alignItems: 'center', justifyContent: 'center' }}>
              <IconPlus size={18} color={C.muted} />
            </View>
            <T style={{ fontSize: 12, color: C.muted }}>Přidat</T>
          </Pressable>
        </ScrollView>

        <Group title={isSelf ? 'Můj profil' : 'Karta: ' + person.name} dot="#F7931E">
          <Row title="Osobní údaje" sub={isSelf ? 'Jméno, pojišťovna, kontakt, tělo' : [REL[person.relation], person.birthDate ? ageLabel(ageOn(person.birthDate, today)) : null].filter(Boolean).join(' · ')} onPress={() => router.push('/nastaveni/osobni')} />
          {!isSelf ? (
            <>
              <Divider />
              <Row title="Upravit nebo odebrat kartu" sub="Jméno, vztah, datum narození" onPress={() => router.push({ pathname: '/nastaveni/karta', params: { id: person.id } })} />
            </>
          ) : null}
          {isSelf ? (
            <>
              <Divider />
              <ToggleRow title="Sledovat cyklus" sub="V zápisu příznaků se objeví sekce Cyklus" value={s.settings.cycleTracking} onChange={(v) => s.updateSettings({ cycleTracking: v })} />
            </>
          ) : null}
        </Group>

        <Group title="Zdraví" dot="#9B3FE0">
          <Row title="Moji lékaři" sub={value?.doctors ? value.doctors + ' · přidat, upravit, odebrat' : 'Zatím žádný'} onPress={() => router.push('/nastaveni/lekari')} />
          <Divider />
          <Row title="Nouzové údaje" sub={value ? `${value.em.filled} z ${value.em.total} vyplněno · co uvidí záchranář` : undefined} warn={!!value && value.em.filled === 0} onPress={() => router.push('/nastaveni/nouzove')} />
        </Group>

        <Group title="Soukromí a bezpečí" dot="#3B6FE0">
          <Row title="Přihlášení a zabezpečení" sub={(s.settings.biometricEnabled ? (s.bio?.label ?? 'Biometrie') + ' zapnuto' : 'Heslo') + ' · zámek, změna hesla'} onPress={() => router.push('/nastaveni/zabezpeceni')} />
          <Divider />
          <Row title={exporting ? 'Připravuji export…' : 'Vzít si svoje data'} sub="Stáhnout vše jako soubor" onPress={exporting ? undefined : doExport} />
          <Divider />
          <Row title="Kdo vidí moje data" sub="Sdílení s rodinou a lékaři" disabledNote="Připravujeme" onPress={soon('Sdílení')} />
          <Divider />
          <Row title="Kdo se mi díval do karty" sub="Záznam přístupů" disabledNote="Připravujeme" onPress={soon('Záznam přístupů')} />
        </Group>

        <Group title="Aplikace" dot="#7A7682">
          <Row title="Vzhled" sub={s.settings.background + ' · ' + s.settings.avatarStyle + ' tlačítko'} onPress={() => router.push('/nastaveni/vzhled')} />
          <Divider />
          <Row title="Upozornění" sub="Termíny, léky, novinky od lékaře" disabledNote="Připravujeme" onPress={soon('Upozornění')} />
        </Group>

        <SecondaryButton style={{ marginTop: 24 }} label="Odhlásit se" onPress={logout} />
        <Muted style={{ marginTop: 12, textAlign: 'center', fontSize: 12 }}>
          HumanCare {Constants.expoConfig?.version ?? ''} · prototyp · data jen v tomto telefonu
        </Muted>
      </ScrollView>
    </View>
  );
}

function Group({ title, dot, children }: { title: string; dot: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 8 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
        <T w="semibold" style={{ fontSize: 12, color: C.muted }}>{title}</T>
      </View>
      <Card style={{ overflow: 'hidden', borderRadius: 22 }}>{children}</Card>
    </View>
  );
}

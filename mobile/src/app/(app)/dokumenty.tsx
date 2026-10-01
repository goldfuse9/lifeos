import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { formatSize, numericDate, plural, toLocalDate, toLocalTime } from '@/domain/dates';
import type { RecordType } from '@/domain/types';
import { Backdrop, BottomFade, H1, Muted, Note, Segmented, T, TopBar, useScreenInsets, useToast, useUi } from '@/ui/kit';
import { ActionFab, MeFab, SearchFab } from '@/ui/fabs';
import { AttachmentPreview } from '@/ui/records';
import { chooseSource, pickFrom } from '@/ui/device';
import { C, F } from '@/ui/theme';
import { IconClose, IconSearch } from '@/ui/icons';

/**
 * Dokumenty — Dokumenty.dc.html. Pohled na všechny přílohy karty.
 * Kategorie se odvozují z typu záznamu, ke kterému soubor patří.
 */

type Kind = 'all' | 'report' | 'result' | 'recipe' | 'doc' | 'photo';

const KINDS: Record<Exclude<Kind, 'all'>, { label: string; stamp: string; bg: string; fg: string }> = {
  report: { label: 'Zpráva', stamp: 'ZPRÁVA', bg: '#F3E9FD', fg: '#6E24B0' },
  result: { label: 'Výsledek', stamp: 'VÝSLEDKY', bg: '#E8EFFD', fg: '#2D56B5' },
  recipe: { label: 'Recept', stamp: 'RECEPT', bg: '#FDF3DF', fg: '#7A4F00' },
  doc: { label: 'Doklad', stamp: 'DOKLAD', bg: '#EFEEF1', fg: '#4A4751' },
  photo: { label: 'Fotka', stamp: '', bg: '#FDECE6', fg: '#9A3A22' },
};

function kindOf(recordType: RecordType, attKind: string): Exclude<Kind, 'all'> {
  if (attKind === 'photo') return 'photo';
  if (recordType === 'result') return 'result';
  if (recordType === 'med') return 'recipe';
  if (recordType === 'doc') return 'doc';
  return 'report';
}

export default function Dokumenty() {
  const ui = useUi();
  const ins = useScreenInsets();
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>('all');
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { value } = useLoad(() => data.attachments.forPerson(person.id), [person.id]);
  const all = useMemo(() => value ?? [], [value]);

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return all.filter((a) => {
      const k = kindOf(a.recordType, a.kind);
      if (kind !== 'all' && k !== kind) return false;
      if (!qq) return true;
      return (a.name + ' ' + a.recordTitle + ' ' + KINDS[k].label).toLowerCase().includes(qq);
    });
  }, [all, kind, q]);

  const upload = async () => {
    const src = await chooseSource('Nahrát do karty: ' + person.name);
    if (!src) return;
    const picked = await pickFrom(src);
    if (!picked.length) return;
    setBusy(true);
    try {
      const now = new Date();
      const base = picked[0].name.replace(/\.[a-z0-9]{1,6}$/i, '');
      const title = picked.length > 1 ? `${base} a další (${picked.length})` : base || 'Dokument';
      const rec = await data.records.create(person.id, { type: 'doc', title, description: '', date: toLocalDate(now), time: toLocalTime(now) });
      let ok = 0;
      for (const p of picked) {
        try {
          await data.files.add(rec.id, person.id, p);
          ok++;
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Soubor se nepodařilo uložit.');
        }
      }
      if (!ok) {
        await data.records.softDelete(rec.id);
        return;
      }
      touch();
      toast('Nahráno · zkontrolujte název a datum');
      router.push(`/zaznam/${rec.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: ins.bottom }}>
        <TopBar title={person.name} backLabel="Zpět na přehled" />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Dokumenty</H1>
          <Muted style={{ marginTop: 4 }}>{all.length + ' ' + plural(all.length, 'soubor', 'soubory', 'souborů')} · jen v tomto telefonu</Muted>
        </View>

        {searchOpen ? (
          <View style={{ marginTop: 16, height: 48, borderRadius: 24, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 4, gap: 8 }}>
            <IconSearch size={16} color={C.muted} width={1.6} />
            <TextInput autoFocus value={q} onChangeText={setQ} accessibilityLabel="Hledat v dokumentech" placeholder="Název, záznam, typ…" placeholderTextColor="#8E8C94" style={{ flex: 1, height: 48, fontFamily: F.regular, fontSize: 15, color: C.ink }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Zavřít hledání" onPress={() => { setQ(''); setSearchOpen(false); }} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <IconClose size={16} />
            </Pressable>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          <Segmented<Kind>
            label="Typ dokumentu"
            value={kind}
            onChange={setKind}
            options={[['all', 'Vše'], ['report', 'Zprávy'], ['result', 'Výsledky'], ['recipe', 'Recepty'], ['doc', 'Doklady'], ['photo', 'Fotky']]}
          />
        </ScrollView>

        <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {list.map((a, i) => {
            const k = KINDS[kindOf(a.recordType, a.kind)];
            return (
              <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={'Otevřít ' + a.name} onPress={() => router.push(`/priloha/${a.id}`)} style={({ pressed }) => ({ width: '48.5%', height: 204, borderRadius: 28, backgroundColor: ui.tile, borderWidth: 1, borderColor: ui.tileLine, boxShadow: ui.shadow, overflow: 'hidden', opacity: pressed ? 0.85 : 1 })}>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 20, alignItems: 'center' }}>
                  <AttachmentPreview a={a} uri={data.files.uri(a)} tilt={[-4, 3, -2, 4][i % 4]} stamp={k.stamp || undefined} />
                </View>
                <View style={{ position: 'absolute', top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: k.bg }}>
                  <T w="semibold" style={{ fontSize: 11, lineHeight: 14, color: k.fg }}>{k.label}</T>
                </View>
                <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8, height: 56, paddingHorizontal: 14, borderRadius: 22, backgroundColor: C.white, justifyContent: 'center', boxShadow: '0px -4px 18px rgba(40,40,40,0.06)' }}>
                  <T w="semibold" numberOfLines={1} style={{ fontSize: 14, lineHeight: 18, color: C.ink2 }}>{a.name}</T>
                  <T style={{ fontSize: 12, lineHeight: 16, color: C.muted }}>{numericDate(a.recordDate) + ' · ' + formatSize(a.size)}</T>
                </View>
              </Pressable>
            );
          })}
        </View>

        {!list.length ? (
          <View style={{ marginTop: 16, paddingVertical: 32, paddingHorizontal: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DCDAD6', borderRadius: 24, alignItems: 'center' }}>
            <Muted style={{ textAlign: 'center' }}>{all.length ? 'Nic neodpovídá výběru.' : 'Tady zatím nic není. Vyfoťte zprávu nebo vyberte PDF tlačítkem Nahrát.'}</Muted>
          </View>
        ) : null}

        <Note style={{ marginTop: 20 }}>Soubory jsou jen v tomto telefonu, v soukromé složce aplikace. Sdílení s lékařem přijde s online verzí.</Note>
      </ScrollView>

      <BottomFade />
      <ActionFab label={busy ? 'Ukládám…' : 'Nahrát'} onPress={busy ? () => {} : upload} />
      <SearchFab label="Hledat v dokumentech" active={!!q} onPress={() => setSearchOpen((o) => !o)} />
      <MeFab label="Zpět na přehled" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
  );
}

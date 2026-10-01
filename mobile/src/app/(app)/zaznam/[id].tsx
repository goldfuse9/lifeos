import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData, useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { RECORD_TYPES } from '@/domain/recordTypes';
import { longDate, parseLocalDate } from '@/domain/dates';
import { Backdrop, Card, H1, Loading, Muted, PrimaryButton, SecondaryButton, T, TopBar, useScreenInsets, useToast } from '@/ui/kit';
import { AttachmentPreview, TypeDot } from '@/ui/records';
import { chooseSource, confirm, pickFrom } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconClip, IconTrash } from '@/ui/icons';

/** Detail záznamu: obsah, přílohy, úprava, smazání. */
export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useData();
  const { touch, persons } = useSession();
  const toast = useToast();
  const ins = useScreenInsets();
  const [busy, setBusy] = useState(false);

  const { value, loading } = useLoad(async () => {
    const r = await data.records.get(String(id));
    if (!r) return null;
    const files = await data.attachments.forRecord(r.id);
    return { r, files };
  }, [id]);

  if (loading && value === undefined) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <View style={{ paddingTop: ins.top, paddingHorizontal: 16 }}>
          <TopBar />
          <Loading />
        </View>
      </View>
    );
  }

  if (!value) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <View style={{ paddingTop: ins.top, paddingHorizontal: 16 }}>
          <TopBar />
          <H1 style={{ marginTop: 18, paddingLeft: 8 }}>Záznam už neexistuje</H1>
          <Muted style={{ paddingLeft: 8, marginTop: 4 }}>Byl smazán.</Muted>
        </View>
      </View>
    );
  }

  const { r, files } = value;
  const t = RECORD_TYPES[r.type];
  const m = r.metadata || {};
  const person = persons.find((p) => p.id === r.personId);
  const d = parseLocalDate(r.date);

  const addFiles = async () => {
    const src = await chooseSource('Přidat k záznamu');
    if (!src) return;
    const picked = await pickFrom(src);
    if (!picked.length) return;
    setBusy(true);
    let ok = 0;
    for (const p of picked) {
      try {
        await data.files.add(r.id, r.personId, p);
        ok++;
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Soubor se nepodařilo uložit.');
      }
    }
    setBusy(false);
    if (ok) {
      toast(ok === 1 ? 'Příloha uložena' : `Uloženo ${ok} příloh`);
      touch();
    }
  };

  const remove = async () => {
    const ok = await confirm('Smazat záznam?', files.length ? `Smaže se i ${files.length === 1 ? 'příloha' : files.length + ' přílohy'}.` : 'Záznam zmizí z osy i z kalendáře.', 'Smazat');
    if (!ok) return;
    await data.records.softDelete(r.id);
    await data.files.collectGarbage();
    touch();
    toast('Záznam smazán');
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person?.name} />
        <View style={{ marginTop: 18, paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TypeDot r={r} size={24} />
          <T w="semibold" style={{ fontSize: 13, color: t.text }}>{t.label}</T>
          {m.badge ? (
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: m.badgeTone === 'warn' ? '#FDF1DA' : C.okTint }}>
              <T w="semibold" style={{ fontSize: 12, color: m.badgeTone === 'warn' ? '#7A4F00' : C.ok }}>{m.badge}</T>
            </View>
          ) : null}
        </View>
        <View style={{ paddingLeft: 8 }}>
          <H1 style={{ marginTop: 6 }}>{r.title}</H1>
          <Muted style={{ marginTop: 4 }}>{longDate(r.date) + ' ' + d.getFullYear() + (r.time ? ' · ' + r.time : ' · celý den')}</Muted>
        </View>

        {r.description || m.place || (m.tags && m.tags.length) ? (
          <Card style={{ marginTop: 16, padding: 16, gap: 12 }}>
            {m.place ? <InfoRow label="Kde / u koho" value={m.place} /> : null}
            {m.tags && m.tags.length ? <InfoRow label="Obecně" value={m.tags.join(', ')} /> : null}
            {r.description ? (
              <View>
                {m.place || (m.tags && m.tags.length) ? <T style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Poznámka</T> : null}
                <T selectable style={{ fontSize: 16, lineHeight: 24 }}>{r.description}</T>
              </View>
            ) : null}
          </Card>
        ) : null}

        {m.children && m.children.length ? (
          <Card white style={{ marginTop: 12, padding: 14, gap: 10 }}>
            {m.children.map((c, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 8, height: 8, marginTop: 6, borderRadius: 4, backgroundColor: RECORD_TYPES[c.type]?.color ?? C.muted }} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 12, lineHeight: 16, color: C.muted }}>{c.label}</T>
                  <T style={{ fontSize: 15, lineHeight: 21 }}>{c.value}</T>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <T w="semibold" style={{ fontSize: 13, color: C.muted }}>{files.length ? 'Přílohy · ' + files.length : 'Přílohy'}</T>
        </View>
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {files.map((a, i) => (
            <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={'Otevřít ' + a.name} onPress={() => router.push(`/priloha/${a.id}`)} style={({ pressed }) => ({ width: '48%', height: 180, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.58)', borderWidth: 1, borderColor: 'rgba(23,22,26,0.05)', overflow: 'hidden', opacity: pressed ? 0.8 : 1 })}>
              <View style={{ position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center' }}>
                <AttachmentPreview a={a} uri={data.files.uri(a)} height={104} width={84} tilt={i % 2 ? 3 : -3} />
              </View>
              <View style={{ position: 'absolute', left: 6, right: 6, bottom: 6, height: 48, paddingHorizontal: 12, borderRadius: 18, backgroundColor: C.white, justifyContent: 'center' }}>
                <T w="semibold" numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, color: C.ink2 }}>{a.name}</T>
                <T style={{ fontSize: 11, lineHeight: 15, color: C.muted }}>{a.kind === 'photo' ? 'Fotka' : a.kind === 'pdf' ? 'PDF' : 'Soubor'}</T>
              </View>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={addFiles} disabled={busy} style={({ pressed }) => ({ width: files.length ? '48%' : '100%', height: files.length ? 180 : 64, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DCDAD6', alignItems: 'center', justifyContent: 'center', flexDirection: files.length ? 'column' : 'row', gap: 8, opacity: pressed || busy ? 0.6 : 1 })}>
            <IconClip size={18} color={C.muted} />
            <T w="semibold" style={{ fontSize: 14, color: C.muted }}>{busy ? 'Ukládám…' : 'Přidat přílohu'}</T>
          </Pressable>
        </View>

        <View style={{ marginTop: 28, gap: 10 }}>
          <PrimaryButton label="Upravit" onPress={() => (r.type === 'cycle' ? router.push({ pathname: '/cyklus/zapis', params: { id: r.id } }) : r.type === 'vaccine' ? router.push({ pathname: '/ockovani/upravit', params: { id: r.id } }) : router.push({ pathname: '/zaznam/upravit', params: { id: r.id } }))} />
          <SecondaryButton label="Smazat záznam" danger onPress={remove} icon={<IconTrash size={16} color={C.danger} width={1.8} />} />
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <T style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{label}</T>
      <T selectable style={{ fontSize: 16, lineHeight: 22 }}>{value}</T>
    </View>
  );
}

import React, { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useData, usePerson } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { RECORD_TYPES } from '@/domain/recordTypes';
import { recordSubtitle } from '@/domain/timeline';
import { numericDate } from '@/domain/dates';
import { Backdrop, Muted, PillButton, T, useScreenInsets, useUi } from '@/ui/kit';
import { TypeDot } from '@/ui/records';
import { C, F } from '@/ui/theme';
import { IconBack, IconSearch } from '@/ui/icons';

/** Hledání v celé kartě (z Přehledu, růžové tlačítko). */
export default function Hledat() {
  const ui = useUi();
  const data = useData();
  const person = usePerson();
  const ins = useScreenInsets();
  const [q, setQ] = useState('');

  const { value } = useLoad(async () => (q.trim().length >= 2 ? data.records.query({ personId: person.id, text: q, limit: 100 }) : []), [q, person.id]);
  const list = value ?? [];

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <View style={{ paddingTop: ins.top, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <PillButton accessibilityRole="button" accessibilityLabel="Zpět" onPress={() => router.back()}>
          <IconBack color={C.muted} />
        </PillButton>
        <View style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 }}>
          <IconSearch size={16} color={C.muted} width={1.6} />
          <TextInput
            autoFocus
            accessibilityLabel={'Hledat v kartě ' + person.name}
            value={q}
            onChangeText={setQ}
            placeholder={'Hledat v kartě…'}
            placeholderTextColor="#8E8C94"
            returnKeyType="search"
            style={{ flex: 1, height: 44, fontFamily: F.regular, fontSize: 16, color: C.ink }}
          />
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        ListEmptyComponent={
          <Muted style={{ textAlign: 'center', marginTop: 40 }}>
            {q.trim().length < 2 ? 'Napište aspoň dvě písmena — hledá se v názvech, poznámkách, příznacích i přílohách.' : 'Nic nenalezeno.'}
          </Muted>
        }
        renderItem={({ item: r, index }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/zaznam/${r.id}`)} style={({ pressed }) => ({ minHeight: 64, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? ui.cardW : ui.card, borderRadius: 18, borderWidth: 1, borderColor: ui.line, marginTop: index ? 8 : 0 })}>
            <TypeDot r={r} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{r.title}</T>
              <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>
                {[numericDate(r.date), RECORD_TYPES[r.type].label, recordSubtitle(r)].filter(Boolean).join(' · ')}
              </T>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

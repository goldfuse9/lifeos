import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Platform, Pressable, TextInput, View, useAnimatedValue, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData, usePerson, useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { RECORD_TYPES } from '@/domain/recordTypes';
import { numericDate } from '@/domain/dates';
import { recordSubtitle } from '@/domain/timeline';
import { C, F } from './theme';
import { RadialFill, T, haptic } from './kit';
import { IconClose, IconSearch } from './icons';

/**
 * Hledání v kartě — přesně podle Prehled.dc.html: růžové kulaté tlačítko
 * se roztáhne do bílé lišty u spodního okraje, pozadí se rozostří a nad
 * lištou je panel. Bez dotazu ukazuje „Nedávno hledané“, s dotazem
 * „Výsledky (n)“ — nejvýš pět záznamů.
 *
 * Nedávno hledané jsou skutečná hledání (posledních pět), ne vzorová slova.
 */

const MAX_RESULTS = 5;
const MAX_RECENT = 5;

export function PrehledSearch({ open, onOpen, onClose, revealed = true }: { open: boolean; onOpen: () => void; onClose: () => void; revealed?: boolean }) {
  const data = useData();
  const person = usePerson();
  const { settings, updateSettings } = useSession();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const [q, setQ] = useState('');
  const anim = useAnimatedValue(open ? 1 : 0);
  // Vysunutí z rozbalovacího menu (zelené tlačítko).
  const rev = useAnimatedValue(revealed ? 1 : 0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(anim, { toValue: open ? 1 : 0, duration: 380, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start(() => {
      if (open) inputRef.current?.focus();
    });
  }, [open, anim]);

  useEffect(() => {
    Animated.timing(rev, { toValue: revealed ? 1 : 0, duration: 260, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start();
  }, [revealed, rev]);

  const query = q.trim();
  const { value } = useLoad(async () => (query.length >= 1 && open ? data.records.query({ personId: person.id, text: query, limit: 51 }) : []), [query, person.id, open]);
  const found = value ?? [];
  const results = found.slice(0, MAX_RESULTS);
  const recent = (settings.recentSearches ?? []).slice(0, MAX_RECENT);

  const close = () => {
    Keyboard.dismiss();
    setQ('');
    onClose();
  };

  const remember = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...(settings.recentSearches ?? []).filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
    updateSettings({ recentSearches: next });
  };

  const openRecord = (id: string) => {
    remember(query);
    close();
    router.push(`/zaznam/${id}`);
  };

  const bottom = 32 + Math.max(0, insets.bottom - 16);
  const fullW = screenW - 32;
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: [56, fullW] });
  const right = anim.interpolate({ inputRange: [0, 1], outputRange: [80, 16] });
  const pinkOpacity = anim.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' });
  const scrimOpacity = anim;

  const label = found.length ? `Výsledky (${found.length > 50 ? '50+' : found.length})` : 'Nic nenalezeno';

  return (
    <>
      {/* Rozostřené pozadí — klepnutí zavře (anyPanel / closeAll na desce) */}
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 18, opacity: scrimOpacity }}>
        <Pressable accessibilityLabel="Zavřít hledání" onPress={close} style={{ flex: 1, backgroundColor: 'rgba(245,245,244,0.6)' }} />
      </Animated.View>

      <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, zIndex: 20 }}>
        <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end' }}>
          {open ? (
            <View style={{ marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: C.line, boxShadow: '0px 20px 48px rgba(40,40,40,0.12)' }}>
              {!query ? (
                <>
                  <T w="semibold" style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>Nedávno hledané</T>
                  {recent.length ? (
                    <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {recent.map((r) => (
                        <Pressable key={r} accessibilityRole="button" onPress={() => { haptic(); setQ(r); }} style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.chip, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
                          <T style={{ fontSize: 14 }}>{r}</T>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <T style={{ marginTop: 6, fontSize: 14, lineHeight: 20, color: C.muted }}>Zatím nic. Hledá se v názvech, poznámkách, příznacích i přílohách.</T>
                  )}
                </>
              ) : (
                <>
                  <T w="semibold" style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{label}</T>
                  {results.map((r, i) => (
                    <Pressable key={r.id} accessibilityRole="button" onPress={() => openRecord(r.id)} style={({ pressed }) => ({ minHeight: 52, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: i === 0 ? 'transparent' : C.line, opacity: pressed ? 0.6 : 1 })}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: RECORD_TYPES[r.type].color }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T w="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{r.title}</T>
                        <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{[numericDate(r.date), recordSubtitle(r) || RECORD_TYPES[r.type].label].join(' · ')}</T>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}
            </View>
          ) : null}

          {/* Lišta — roste z růžového tlačítka */}
          <View style={{ height: 56 + bottom }} pointerEvents={open || revealed ? 'box-none' : 'none'}>
            <Animated.View
              style={{
                position: 'absolute', bottom, right: Animated.add(right, rev.interpolate({ inputRange: [0, 1], outputRange: [-64, 0] })), width, opacity: rev, height: 56, borderRadius: 28, overflow: 'hidden',
                backgroundColor: open ? 'rgba(255,255,255,0.95)' : 'transparent',
                borderWidth: 1, borderColor: open ? C.line : 'rgba(255,255,255,0.35)',
                boxShadow: open ? '0px 20px 48px rgba(40,40,40,0.12)' : '0px 12px 32px rgba(238,63,122,0.40)',
              }}
            >
              <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: pinkOpacity }}>
                <RadialFill stops={['#EE3F7A', '#F2729A', '#F7B3C7']} radius={28} />
              </Animated.View>
              {open ? (
                <View style={{ flex: 1, padding: 7, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: C.field, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
                    <IconSearch size={16} color={C.muted} width={1.6} />
                    <TextInput
                      ref={inputRef}
                      accessibilityLabel="Hledat v kartě"
                      value={q}
                      onChangeText={setQ}
                      onSubmitEditing={() => remember(query)}
                      placeholder="Hledat v kartě…"
                      placeholderTextColor="#8E8C94"
                      returnKeyType="search"
                      style={{ flex: 1, height: 40, fontFamily: F.regular, fontSize: 15, color: C.ink }}
                    />
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Zavřít hledání" onPress={close} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                    <IconClose size={18} width={1.6} />
                  </Pressable>
                </View>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="Hledat" onPress={() => { haptic(); onOpen(); }} style={{ width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }}>
                  <View pointerEvents="none" style={{ position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' }} />
                  <IconSearch color={C.white} />
                </Pressable>
              )}
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

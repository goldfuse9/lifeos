import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useData, usePerson, useSession } from '@/state/session';
import { useCycle } from '@/state/useCycle';
import { MOODS, SYM_GENERAL, SYM_GROUPS, SYM_INTENSITY, SYM_RED_FLAGS, isPainful } from '@/domain/recordTypes';
import { buildSymptomRecord, emptySelection, selectionCount, type SymptomSelection } from '@/domain/timeline';
import { plural, toLocalDate, toLocalTime } from '@/domain/dates';
import { Backdrop, Callout, Chip, PillButton, PrimaryButton, SecondaryButton, T, haptic, useToast } from '@/ui/kit';
import { C } from '@/ui/theme';
import { IconChevronDown, IconClose } from '@/ui/icons';

/**
 * Zápis nálady, příznaků a bolestí — list z desky (sym sheet).
 * Uloží se jako jeden záznam do osy s časem „teď“.
 */
export default function Zapis() {
  const data = useData();
  const person = usePerson();
  const { self, touch } = useSession();
  const cycle = useCycle();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<SymptomSelection>(emptySelection);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const isSelf = !!self && self.id === person.id;
  // Cyklus jen na vlastní kartě a jen když si ho člověk zapnul (jako na plátně).
  const groups = SYM_GROUPS.filter((g) => !g.cycle || !!cycle.settings.enabled);
  const count = selectionCount(s);
  const canSave = s.mood != null || count > 0;
  const redFlag = Object.values(s.byGroup).some((list) => list.some((x) => SYM_RED_FLAGS.includes(x)));

  const toggleIn = (key: string, item: string) =>
    setS((cur) => {
      const list = (cur.byGroup[key] || []).slice();
      const at = list.indexOf(item);
      if (at === -1) list.push(item);
      else list.splice(at, 1);
      return { ...cur, byGroup: { ...cur.byGroup, [key]: list } };
    });

  const save = async () => {
    const built = buildSymptomRecord(s);
    if (!built) return;
    setBusy(true);
    try {
      const now = new Date();
      await data.records.create(person.id, { ...built, date: toLocalDate(now), time: toLocalTime(now) });
      touch();
      toast('Zapsáno do osy' + (count ? ' · ' + count + ' ' + plural(count, 'příznak', 'příznaky', 'příznaků') : ''));
      router.back();
    } catch {
      setBusy(false);
      toast('Uložení se nepovedlo.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 140 + insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingLeft: 8, paddingTop: 4 }}>
            <T w="semibold" accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.6 }}>
              {isSelf ? 'Jak se cítíte?' : `Jak se ${person.name} cítí?`}
            </T>
            <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>Nálada, příznaky a bolesti · zápis do osy</T>
          </View>
          <PillButton accessibilityRole="button" accessibilityLabel="Zavřít zápis" onPress={() => router.back()}>
            <IconClose size={18} color={C.muted} />
          </PillButton>
        </View>

        {/* Obličeje */}
        <View accessibilityRole="radiogroup" accessibilityLabel="Nálada" style={{ marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
          {MOODS.map((m, i) => {
            const on = s.mood === i;
            const dim = s.mood != null && !on;
            return (
              <Pressable
                key={m.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={m.label}
                onPress={() => {
                  haptic();
                  setS((c) => ({ ...c, mood: c.mood === i ? null : i }));
                }}
                style={{ alignItems: 'center', gap: 6, width: 64, opacity: dim ? 0.5 : 1 }}
              >
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: m.tint, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? C.orange : 'transparent', transform: [{ scale: on ? 1.1 : 1 }] }}>
                  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx="12" cy="12" r="9" />
                    <Circle cx="9" cy="10" r="0.9" fill={m.color} />
                    <Circle cx="15" cy="10" r="0.9" fill={m.color} />
                    <Path d={m.mouth} />
                  </Svg>
                </View>
                <T w={on ? 'semibold' : 'regular'} style={{ fontSize: 11, lineHeight: 14, textAlign: 'center', color: C.ink }}>{m.label}</T>
              </Pressable>
            );
          })}
        </View>

        {/* Obecné */}
        <T w="semibold" style={{ marginTop: 24, fontSize: 13, color: C.muted, paddingLeft: 4 }}>Obecně</T>
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {SYM_GENERAL.map((g) => (
            <Chip key={g} tone="orange" label={g} selected={s.general.includes(g)} onPress={() => setS((c) => ({ ...c, general: c.general.includes(g) ? c.general.filter((x) => x !== g) : [...c.general, g] }))} />
          ))}
        </View>

        {/* Oblasti těla */}
        <T w="semibold" style={{ marginTop: 24, fontSize: 13, color: C.muted, paddingLeft: 4 }}>Kde to je</T>
        <View style={{ marginTop: 8, gap: 8 }}>
          {groups.map((g) => {
            const sel = s.byGroup[g.key] || [];
            const cnt = sel.length + (g.cycle && s.flow ? 1 : 0);
            const isOpen = !!open[g.key];
            const summary = (g.cycle && s.flow ? ['Menstruace: ' + s.flow.toLowerCase()] : []).concat(sel);
            const showInt = sel.some(isPainful);
            return (
              <View key={g.key} style={{ borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))} style={{ minHeight: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 13, backgroundColor: g.tint, alignItems: 'center', justifyContent: 'center' }}>
                    <T w="semibold" style={{ color: g.fg, fontSize: 13 }}>{g.name.slice(0, 2)}</T>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T w="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{g.name}</T>
                    <T numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: summary.length ? C.orangeInk : C.muted }}>
                      {summary.length ? summary.join(', ') : g.cycle ? 'Menstruace, premenstruační příznaky' : 'Nic nevybráno'}
                    </T>
                  </View>
                  {cnt ? (
                    <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' }}>
                      <T w="semibold" style={{ fontSize: 12, color: C.white }}>{cnt}</T>
                    </View>
                  ) : null}
                  <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
                    <IconChevronDown size={18} color={C.muted} />
                  </View>
                </Pressable>
                {isOpen ? (
                  <View style={{ paddingHorizontal: 12, paddingBottom: 14, gap: 10 }}>
                    {g.flow ? (
                      <>
                        <T style={{ fontSize: 12, color: C.muted }}>Menstruace</T>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {g.flow.map((f) => (
                            <Chip key={f} tone="orange" label={f} selected={s.flow === f} onPress={() => setS((c) => ({ ...c, flow: c.flow === f ? null : f }))} />
                          ))}
                        </View>
                      </>
                    ) : null}
                    <T style={{ fontSize: 12, color: C.muted }}>{g.cycle ? 'Premenstruační a další příznaky' : 'Co přesně'}</T>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {g.items.map((it) => (
                        <Chip key={it} tone="orange" label={it} selected={sel.includes(it)} onPress={() => toggleIn(g.key, it)} />
                      ))}
                    </View>
                    {showInt ? (
                      <>
                        <T style={{ fontSize: 12, color: C.muted }}>Jak silná je bolest v této oblasti?</T>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {SYM_INTENSITY.map((lab, i) => (
                            <Chip key={lab} label={lab} selected={s.intensity[g.key] === i + 1} onPress={() => setS((c) => ({ ...c, intensity: { ...c.intensity, [g.key]: c.intensity[g.key] === i + 1 ? 0 : i + 1 } }))} />
                          ))}
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {redFlag ? (
          <Callout tone="red" title="Bolest na hrudi nebo dušnost?" style={{ marginTop: 16 }}>
            Pokud je to náhlé nebo silné, nečekejte a volejte záchrannou službu 155.
          </Callout>
        ) : null}
        {redFlag ? <SecondaryButton style={{ marginTop: 8 }} danger label="Volat 155" onPress={() => Linking.openURL('tel:155')} /> : null}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 + insets.bottom, backgroundColor: 'rgba(252,251,250,0.96)', borderTopWidth: 1, borderTopColor: C.line, gap: 6 }}>
        <T style={{ textAlign: 'center', fontSize: 13, color: C.muted }}>
          {!canSave ? 'Vyberte náladu nebo příznak' : count ? count + ' ' + plural(count, 'příznak', 'příznaky', 'příznaků') + (s.mood != null ? ' · ' + MOODS[s.mood].label.toLowerCase() : '') : MOODS[s.mood!].label}
        </T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SecondaryButton label="Zrušit" onPress={() => router.back()} style={{ flex: 1 }} />
          <PrimaryButton label="Zapsat" onPress={save} disabled={!canSave} busy={busy} style={{ flex: 2 }} />
        </View>
      </View>
    </View>
  );
}

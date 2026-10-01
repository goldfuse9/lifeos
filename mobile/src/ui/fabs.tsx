import React, { useEffect } from 'react';
import { Animated, Easing, Pressable, View, useAnimatedValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { C, ME_STYLES, initials } from './theme';
import { PillButton, RadialFill, T, haptic } from './kit';
import { IconMoodFab, IconPlus, IconSearch } from './icons';

/**
 * Plovoucí tlačítka u spodního okraje.
 * Přehled: jen zelené „já“ vpravo dole; první klepnutí rozbalí nabídku
 * (nálada, hledání), druhé otevře kartu a nastavení. Po ~4,5 s nečinnosti
 * nebo dotyku jinde se nabídka zase sbalí.
 * Osa, Cyklus, Dokumenty: místo menu jedno černé tlačítko „+ Zapsat“.
 */

export const MENU_IDLE_MS = 4500;

const PINK = ['#EE3F7A', '#F2729A', '#F7B3C7'] as const;
const ORANGE = ['#F7931E', '#F9A945', '#FCD29B'] as const;

function Round({ stops, label, onPress, children, right, shadow, border, ring, expanded }: { stops: readonly string[]; label: string; onPress: () => void; children: React.ReactNode; right: number; shadow: string; border: string; ring: string; expanded?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded != null ? { expanded } : undefined}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => ({
        position: 'absolute', bottom: 32 + Math.max(0, insets.bottom - 16), right, zIndex: 19,
        width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: border, boxShadow: shadow,
        alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <RadialFill stops={stops} radius={28} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderRadius: 20, borderWidth: 1, borderColor: ring }} />
      {children}
    </Pressable>
  );
}

/** „Já“ — iniciály, vpravo dole. */
export function MeFab({ onPress, label = 'Moje karta a nastavení', expanded }: { onPress: () => void; label?: string; expanded?: boolean }) {
  const { settings, self, account } = useSession();
  const s = ME_STYLES[settings.avatarStyle] ?? ME_STYLES.limetková;
  const name = account?.name || self?.name || '';
  return (
    <Round stops={s.stops} label={label} onPress={onPress} right={16} shadow={s.shadow} border={s.border} ring={s.ring} expanded={expanded}>
      <T w="semibold" style={{ fontSize: 16, letterSpacing: 0.3, color: s.fg }}>{initials(name)}</T>
    </Round>
  );
}

export function SearchFab({ onPress, active, label = 'Hledat' }: { onPress: () => void; active?: boolean; label?: string }) {
  return (
    <Round stops={PINK} label={label} onPress={onPress} right={80} shadow="0px 12px 32px rgba(238,63,122,0.40)" border="rgba(255,255,255,0.35)" ring="rgba(255,255,255,0.65)">
      <IconSearch color={C.white} />
      {active ? <View style={{ position: 'absolute', top: 9, right: 9, width: 10, height: 10, borderRadius: 5, backgroundColor: C.lime, borderWidth: 2, borderColor: C.pink }} /> : null}
    </Round>
  );
}

export function MoodFab({ onPress }: { onPress: () => void }) {
  return (
    <Round stops={ORANGE} label="Zapsat, jak se cítíte" onPress={onPress} right={144} shadow="0px 12px 32px rgba(247,147,30,0.40)" border="rgba(255,255,255,0.35)" ring="rgba(255,255,255,0.65)">
      <IconMoodFab color={C.white} size={22} />
    </Round>
  );
}

/** Černé tlačítko vpravo dole („+ Zapsat“, „+ Nahrát“) — akce podle stránky. */
export function ActionFab({ label, onPress, icon, a11y }: { label: string; onPress: () => void; icon?: React.ReactNode; a11y?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => ({
        position: 'absolute', bottom: 32 + Math.max(0, insets.bottom - 16), right: 16, zIndex: 19, height: 56,
        paddingLeft: 16, paddingRight: 22, borderRadius: 28, backgroundColor: C.ink, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        boxShadow: '0px 12px 32px rgba(0,0,0,0.24)', flexDirection: 'row', alignItems: 'center', gap: 8, transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {icon ?? <IconPlus color={C.white} />}
      <T w="semibold" style={{ fontSize: 15, color: C.white }}>{label}</T>
    </Pressable>
  );
}

/**
 * Rozbalovací menu Přehledu. Stav `open` drží rodič, protože růžové
 * hledání (PrehledSearch) se vysouvá spolu s ním.
 */
export function FabMenu({ open, onOpenChange, onMood, onMe }: { open: boolean; onOpenChange: (open: boolean) => void; onMood: () => void; onMe: () => void }) {
  const anim = useAnimatedValue(open ? 1 : 0);

  useEffect(() => {
    Animated.timing(anim, { toValue: open ? 1 : 0, duration: 260, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [open, anim]);

  // Nečinnost — sbalit.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onOpenChange(false), MENU_IDLE_MS);
    return () => clearTimeout(t);
  }, [open, onOpenChange]);

  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [128, 0] });

  return (
    <>
      {/* Dotyk kdekoliv jinde menu sbalí */}
      {open ? <Pressable accessibilityLabel="Sbalit menu" onPressIn={() => onOpenChange(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 17 }} /> : null}
      <Animated.View pointerEvents={open ? 'box-none' : 'none'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 19, opacity: anim, transform: [{ translateX: tx }] }}>
        <MoodFab
          onPress={() => {
            onOpenChange(false);
            onMood();
          }}
        />
      </Animated.View>
      <MeFab label={open ? 'Moje karta a nastavení' : 'Otevřít menu'} expanded={open} onPress={() => (open ? (onOpenChange(false), onMe()) : onOpenChange(true))} />
    </>
  );
}

/** Hledání v hlavičce stránky (Osa, Dokumenty). */
export function SearchPill({ onPress, active, label = 'Hledat' }: { onPress: () => void; active?: boolean; label?: string }) {
  return (
    <PillButton accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      <IconSearch size={18} color={C.muted} />
      {active ? <View style={{ position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: C.pink }} /> : null}
    </PillButton>
  );
}

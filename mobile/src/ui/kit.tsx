import React, { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSession } from '@/state/session';
import { AVATARS, C, F, FAB_SPACE, initials, uiFor, type Ui } from './theme';
import { IconBack, IconChevron } from './icons';

/* ------------------------------------------------------------------ téma */

export function useUi(): Ui {
  const { settings } = useSession();
  return useMemo(() => uiFor(settings.background), [settings.background]);
}

/* ----------------------------------------------------------------- písmo */

type Weight = 'regular' | 'semibold';

export function T({ w = 'regular', style, ...rest }: TextProps & { w?: Weight }) {
  return <Text {...rest} style={[{ fontFamily: w === 'semibold' ? F.semibold : F.regular, color: C.ink }, style]} />;
}

/** Nadpis obrazovky: 32/40, 600, −0,03 em — jako na deskách. */
export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <T w="semibold" accessibilityRole="header" style={[{ fontSize: 32, lineHeight: 40, letterSpacing: -0.96 }, style]}>
      {children}
    </T>
  );
}

export function Muted({ children, style, ...rest }: TextProps & { children: React.ReactNode }) {
  return (
    <T {...rest} style={[{ fontSize: 14, lineHeight: 20, color: C.muted }, style]}>
      {children}
    </T>
  );
}

/* ---------------------------------------------------------------- pozadí */

/** Skleněné pozadí: barevné skvrny z plátna jako radiální přechody. */
export function Backdrop() {
  const ui = useUi();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ui.bg }]}>
      {ui.glass && (
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            {ui.blobs.map((c, i) => (
              <RadialGradient key={i} id={'b' + i} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={c} stopOpacity={1} />
                <Stop offset="0.67" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {/* Polohy odpovídají deskám (390 px šířka) — přepočítané na % */}
          <Circle cx="98%" cy="8%" r="210" fill="url(#b0)" />
          <Circle cx="-1%" cy="27%" r="190" fill="url(#b3)" />
          <Circle cx="13%" cy="68%" r="200" fill="url(#b1)" />
          <Circle cx="91%" cy="99%" r="230" fill="url(#b2)" />
        </Svg>
      )}
    </View>
  );
}

/** Radiální výplň kulatých tlačítek (limetka, růžová, oranžová). */
export function RadialFill({ stops, radius }: { stops: readonly string[]; radius: number }) {
  const id = 'r' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg style={[StyleSheet.absoluteFill, { borderRadius: radius }]}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="45%" r="60%">
          {stops.map((s, i) => (
            <Stop key={i} offset={i / Math.max(1, stops.length - 1)} stopColor={s} />
          ))}
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Mlha u spodního okraje, pod plovoucími tlačítky. */
export function BottomFade() {
  const ui = useUi();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[`rgba(${ui.bgRgb},0)`, `rgba(${ui.bgRgb},0.7)`, `rgba(${ui.bgRgb},0.94)`]}
      locations={[0, 0.6, 1]}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 128 }}
    />
  );
}

/* ----------------------------------------------------------------- karty */

export function Card({ children, style, white }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; white?: boolean }) {
  const ui = useUi();
  return (
    <View
      style={[
        { backgroundColor: white ? ui.cardW : ui.card, borderColor: ui.line, borderWidth: 1, borderRadius: 24, boxShadow: ui.shadow },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Tile({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const ui = useUi();
  return (
    <View style={[{ backgroundColor: ui.tile, borderColor: ui.tileLine, borderWidth: 1, borderRadius: 32, boxShadow: ui.shadow, overflow: 'hidden' }, style]}>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------- tlačítka */

export function haptic() {
  Haptics.selectionAsync().catch(() => {});
}

type BtnProps = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

/** Kulaté 44px tlačítko v hlavičce. */
export function PillButton({ children, style, ...rest }: BtnProps & { children: React.ReactNode }) {
  const ui = useUi();
  return (
    <Pressable
      hitSlop={6}
      {...rest}
      style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, backgroundColor: ui.pill, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

/** Hlavička podstránek: zpět vlevo, jméno karty vpravo. */
export function TopBar({ title, right, onBack, backLabel = 'Zpět' }: { title?: string; right?: React.ReactNode; onBack?: () => void; backLabel?: string }) {
  const ui = useUi();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
      <PillButton accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}>
        <IconBack color={C.muted} />
      </PillButton>
      {right ??
        (title ? (
          <View accessibilityRole="text" style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: ui.pill, justifyContent: 'center' }}>
            <T w="semibold" style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.17 }} numberOfLines={1}>
              {title}
            </T>
          </View>
        ) : null)}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, busy, style, tone = 'dark' }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle>; tone?: 'dark' | 'danger' }) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
          backgroundColor: off ? '#E6E5E2' : tone === 'danger' ? C.danger : C.ink,
          boxShadow: off ? 'none' : '0px 10px 24px rgba(0,0,0,0.14)',
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={C.white} /> : <T w="semibold" style={{ fontSize: 14, color: off ? C.muted : C.white }}>{label}</T>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, style, danger, icon }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle>; danger?: boolean; icon?: React.ReactNode }) {
  const ui = useUi();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        { minHeight: 52, borderRadius: 26, borderWidth: 1, borderColor: ui.line, backgroundColor: ui.cardW, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 18, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      {icon}
      <T w="semibold" style={{ fontSize: 14, color: danger ? C.danger : C.ink }}>{label}</T>
    </Pressable>
  );
}

export function LinkButton({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.6 : 1 }, style]}>
      <T w="semibold" style={{ fontSize: 14, textDecorationLine: 'underline' }}>{label}</T>
    </Pressable>
  );
}

/* --------------------------------------------------------------- výběry */

export function Chip({ label, selected, onPress, dot, tone = 'dark' }: { label: string; selected: boolean; onPress: () => void; dot?: string; tone?: 'dark' | 'orange' }) {
  const on = selected;
  const s =
    tone === 'orange'
      ? on ? { bg: C.orangeTint, fg: C.orangeInk, bd: C.orangeLine } : { bg: C.white, fg: C.ink, bd: C.line }
      : on ? { bg: C.ink, fg: C.white, bd: C.ink } : { bg: C.chip, fg: C.ink, bd: C.line };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: s.bd, backgroundColor: s.bg, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.8 : 1 })}
    >
      {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on && tone === 'dark' && dot === C.ink ? C.white : dot }} /> : null}
      <T w="semibold" style={{ fontSize: 14, color: s.fg }}>{label}</T>
    </Pressable>
  );
}

/** Segmentový přepínač (tablist z desek). */
export function Segmented<K extends string>({ options, value, onChange, label }: { options: [K, string][]; value: K; onChange: (k: K) => void; label?: string }) {
  const ui = useUi();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', padding: 4, borderRadius: 20, backgroundColor: ui.pill, borderWidth: 1, borderColor: ui.tileLine, alignSelf: 'flex-start', flexWrap: 'wrap' }}>
      {options.map(([k, l]) => {
        const on = k === value;
        return (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic();
              onChange(k);
            }}
            style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center', backgroundColor: on ? (ui.glass ? ui.seg : '#E6E5E2') : 'transparent' }}
          >
            <T w="semibold" style={{ fontSize: 14, color: on ? C.ink2 : C.muted }}>{l}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ----------------------------------------------------------------- pole */

export function Field({ label, hint, error, style, ref, ...rest }: TextInputProps & { label: string; hint?: string; error?: string | null; ref?: React.Ref<TextInput> }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6 }, style as StyleProp<ViewStyle>]}>
      <T w="semibold" style={{ fontSize: 13, color: C.muted }}>{label}</T>
      <TextInput
        ref={ref}
        placeholderTextColor="#8E8C94"
        accessibilityLabel={label}
        {...rest}
        onFocus={(e) => {
          setFocus(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          rest.onBlur?.(e);
        }}
        style={{
          minHeight: rest.multiline ? 96 : 48, borderRadius: 16, paddingHorizontal: 14, paddingVertical: rest.multiline ? 12 : 0,
          backgroundColor: C.white, borderWidth: 1, borderColor: error ? C.danger : focus ? C.ink : C.line,
          fontFamily: F.regular, fontSize: 16, color: C.ink, textAlignVertical: rest.multiline ? 'top' : 'center',
        }}
      />
      {error ? <T style={{ fontSize: 13, color: C.danger }}>{error}</T> : hint ? <T style={{ fontSize: 13, color: C.muted }}>{hint}</T> : null}
    </View>
  );
}

/** Řádek nastavení: tečka, název, popis, šipka. */
export function Row({ title, sub, onPress, warn, right, dot, disabledNote, danger }: { title: string; sub?: string; onPress?: () => void; warn?: boolean; right?: React.ReactNode; dot?: string; disabledNote?: string; danger?: boolean }) {
  const inactive = !onPress && !right;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? '#F4F4F3' : 'transparent' })}
    >
      {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w="semibold" style={{ fontSize: 15, lineHeight: 20, color: danger ? C.danger : inactive ? C.muted : C.ink }}>{title}</T>
        {sub ? <T style={{ fontSize: 13, lineHeight: 18, color: warn ? C.orangeInk : C.muted }}>{sub}</T> : null}
      </View>
      {disabledNote ? <Badge label={disabledNote} /> : null}
      {right ?? (onPress ? <IconChevron size={18} color={C.faint} /> : null)}
    </Pressable>
  );
}

export function Badge({ label, bg = '#F1F0EE', fg = C.muted }: { label: string; bg?: string; fg?: string }) {
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 11, backgroundColor: bg }}>
      <T w="semibold" style={{ fontSize: 12, lineHeight: 16, color: fg }}>{label}</T>
    </View>
  );
}

export function ToggleRow({ title, sub, value, onChange, disabled }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <T w="semibold" style={{ fontSize: 15, lineHeight: 20, color: disabled ? C.muted : C.ink }}>{title}</T>
        {sub ? <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>{sub}</T> : null}
      </View>
      <Switch accessibilityLabel={title} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: C.ink, false: '#E6E5E2' }} thumbColor={C.white} ios_backgroundColor="#E6E5E2" />
    </View>
  );
}

export function Divider() {
  const ui = useUi();
  return <View style={{ height: 1, backgroundColor: ui.rule, marginLeft: 14 }} />;
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 20, marginBottom: 8 }}>
      <T w="semibold" style={{ fontSize: 12, lineHeight: 16, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{children}</T>
      {right}
    </View>
  );
}

/** Poznámka s linkou vlevo — z desek („Zbytek karty zůstane zavřený…“). */
export function Note({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ borderLeftWidth: 2, borderLeftColor: '#E4E2DE', paddingLeft: 12, paddingVertical: 4 }, style]}>
      <T style={{ fontSize: 13, lineHeight: 20, color: C.muted }}>{children}</T>
    </View>
  );
}

/** Oranžový rámeček s upozorněním (Doložte zastupování, Chybí rodný list…). */
export function Callout({ title, children, tone = 'orange', style }: { title: string; children?: React.ReactNode; tone?: 'orange' | 'red'; style?: StyleProp<ViewStyle> }) {
  const red = tone === 'red';
  return (
    <View style={[{ padding: 12, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: red ? '#F3A29B' : C.orangeLine, backgroundColor: red ? C.dangerTint : C.warnBg }, style]}>
      <T w="semibold" style={{ fontSize: 14, lineHeight: 20, color: red ? '#8F1D14' : C.orangeInk }}>{title}</T>
      {children ? <T style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: red ? '#8F1D14' : '#6B4A1E' }}>{children}</T> : null}
    </View>
  );
}

export function Avatar({ name, color, size = 52 }: { name: string; color: number; size?: number }) {
  const [a, b] = AVATARS[color % AVATARS.length];
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.35, alignItems: 'center', justifyContent: 'center' }}>
      <T w="semibold" style={{ fontSize: size * 0.33, color: C.ink3 }}>{initials(name)}</T>
    </LinearGradient>
  );
}

/** Odznak data (14 / ŘÍJ) z „Blíží se“ a kalendáře. */
export function DateBadge({ day, mon, tint = C.orangeTint, fg = C.orangeInk }: { day: number | string; mon: string; tint?: string; fg?: string }) {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <T w="semibold" style={{ fontSize: 16, lineHeight: 18, color: fg, fontVariant: ['tabular-nums'] }}>{day}</T>
      <T w="semibold" style={{ fontSize: 10, lineHeight: 12, color: fg, textTransform: 'uppercase', letterSpacing: 0.4 }}>{mon}</T>
    </View>
  );
}

/* --------------------------------------------------------------- obrazovka */

/** Obsah obrazovky na skleněném pozadí s odsazením pod výřez. */
export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  return { top: Math.max(insets.top, 20) + 8, bottom: FAB_SPACE + insets.bottom };
}

export function Loading() {
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
      <ActivityIndicator color={C.muted} />
    </View>
  );
}

/* ------------------------------------------------------------------ toast */

const ToastCtx = createContext<(text: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState('');
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((s: string) => {
    setText(s);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setText(''), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {text ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 104 + insets.bottom, alignItems: 'center' }}>
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: C.ink, boxShadow: '0px 12px 28px rgba(0,0,0,0.2)', maxWidth: '90%' }}>
            <T w="semibold" style={{ fontSize: 14, lineHeight: 20, color: C.white, textAlign: 'center' }}>{text}</T>
          </View>
        </View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

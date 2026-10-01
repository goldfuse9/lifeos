import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { CycleInfo } from '@/domain/cycle';
import { C } from './theme';
import { T, haptic } from './kit';

/**
 * Grafické prvky stránky Cyklus — inspirované předlohou (velké číslo
 * v kruhu z teček, pás dní cyklu), převedené do skla a barev LifeOS.
 */

export const CY = {
  pink: '#E0457B',
  pinkSoft: '#F4A3BF',
  pinkTint: '#FCE4EE',
  lilac: '#B98AEB',
  lilacStrong: '#9B3FE0',
  next: '#F6C1D3',
  past: '#CFCDD2',
  future: '#E6E5E2',
};

type DayKind = 'period' | 'fertile' | 'ovulation' | 'past' | 'future' | 'today';

function kindOf(day: number, info: CycleInfo): DayKind {
  const today = info.day ?? 0;
  if (day === today) return 'today';
  if (day <= info.periodLength) return 'period';
  if (day === info.ovulationDay) return 'ovulation';
  if (day >= info.fertileFrom && day <= info.fertileTo) return 'fertile';
  return day < today ? 'past' : 'future';
}

const DOT: Record<DayKind, string> = {
  period: CY.pink,
  fertile: CY.lilac,
  ovulation: CY.lilacStrong,
  past: CY.past,
  future: CY.future,
  today: C.ink,
};

/**
 * Kruh: každá tečka je jeden den cyklu, uprostřed velké číslo.
 */
export function CycleRing({ info, size = 260 }: { info: CycleInfo; size?: number }) {
  const n = Math.max(15, Math.min(60, info.avgLength));
  const cx = size / 2;
  const r = size / 2 - 14;
  const dots = Array.from({ length: n }, (_, i) => {
    const day = i + 1;
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const k = info.day != null && info.day > n && day === n ? 'today' : kindOf(day, info);
    return { x: cx + r * Math.cos(a), y: cx + r * Math.sin(a), k };
  });

  const late = info.daysUntil != null && info.daysUntil < 0;
  let big = '–';
  let caption = 'Zapište začátek menstruace';
  if (info.hasData && info.day != null) {
    if (info.inPeriod) {
      big = String(info.day);
      caption = 'den menstruace';
    } else if (late) {
      big = String(-info.daysUntil!);
      caption = (-info.daysUntil! === 1 ? 'den' : -info.daysUntil! < 5 ? 'dny' : 'dní') + ' zpoždění';
    } else if (info.daysUntil === 0) {
      big = 'dnes';
      caption = 'odhad menstruace';
    } else {
      big = String(info.daysUntil);
      caption = (info.daysUntil === 1 ? 'den' : info.daysUntil! < 5 ? 'dny' : 'dní') + ' do menstruace';
    }
  }

  return (
    <View accessible accessibilityLabel={info.hasData ? `${big} ${caption}` : caption} style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="cyGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#F7B3C7" stopOpacity={0.55} />
            <Stop offset="0.6" stopColor="#FCE4EE" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cx} r={r - 22} fill="url(#cyGlow)" />
        <Circle cx={cx} cy={cx} r={r - 22} stroke="rgba(224,69,123,0.12)" strokeWidth={2} fill="none" />
        {dots.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={d.k === 'today' ? 6.5 : d.k === 'ovulation' ? 5 : 4} fill={DOT[d.k]} />
        ))}
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <T w="semibold" style={{ fontSize: big.length > 3 ? 44 : 64, lineHeight: big.length > 3 ? 52 : 72, letterSpacing: -2, color: late ? CY.pink : C.ink, fontVariant: ['tabular-nums'] }}>{big}</T>
        <T w="semibold" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: C.muted, textAlign: 'center', maxWidth: size - 90 }}>{caption}</T>
      </View>
    </View>
  );
}

/**
 * Pás dní: dvě tečky na den, dnešek tmavý se štítkem „DNES“ — jako
 * v předloze, ale s fázemi LifeOS (menstruace, plodné dny, ovulace).
 */
export function DayStrip({ info }: { info: CycleInfo }) {
  const n = Math.max(15, Math.min(45, info.avgLength));
  const today = info.day != null ? Math.min(info.day, n) : null;
  return (
    <View>
      <View style={{ flexDirection: 'row', marginTop: 14 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: n }, (_, i) => {
          const day = i + 1;
          const k = kindOf(day, info);
          const c = DOT[k];
          const big = k === 'today';
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <View style={{ width: big ? 7 : 5, height: big ? 7 : 5, borderRadius: 4, backgroundColor: c }} />
              <View style={{ width: big ? 7 : 5, height: big ? 7 : 5, borderRadius: 4, backgroundColor: c, opacity: big ? 1 : 0.6 }} />
            </View>
          );
        })}
      </View>
      {today != null ? (
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          <View style={{ flex: Math.max(0.001, today - 1) }} />
          <View style={{ alignItems: 'center', marginHorizontal: -30, width: 60 }}>
            <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: C.line }} />
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }}>
              <T w="semibold" style={{ fontSize: 10, letterSpacing: 0.8, color: C.ink }}>DNES</T>
            </View>
          </View>
          <View style={{ flex: Math.max(0.001, n - today) }} />
        </View>
      ) : null}
      <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {([['Menstruace', CY.pink], ['Plodné dny', CY.lilac], ['Ovulace', CY.lilacStrong]] as const).map(([l, c]) => (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
            <T style={{ fontSize: 12, color: C.muted }}>{l}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Popisek karty — malá ikona a text velkými písmeny (z předlohy). */
export function CardLabel({ children, icon }: { children: string; icon?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon}
      <T w="semibold" style={{ fontSize: 11, lineHeight: 14, letterSpacing: 1, textTransform: 'uppercase', color: C.muted }}>{children}</T>
    </View>
  );
}

/** − číslo + */
export function Stepper({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: (n: number) => string; onChange: (n: number) => void }) {
  const btn = (txt: string, d: number, a11y: string) => {
    const disabled = value + d < min || value + d > max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        disabled={disabled}
        onPress={() => {
          haptic();
          onChange(value + d);
        }}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.chip, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
      >
        <T w="semibold" style={{ fontSize: 20, lineHeight: 22 }}>{txt}</T>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }} accessibilityLabel={`${label}: ${value} ${unit(value)}`}>
      <T w="semibold" style={{ flex: 1, fontSize: 15 }}>{label}</T>
      {btn('−', -1, 'Méně')}
      <T w="semibold" style={{ minWidth: 64, textAlign: 'center', fontSize: 16, fontVariant: ['tabular-nums'] }}>{value + ' ' + unit(value)}</T>
      {btn('+', 1, 'Více')}
    </View>
  );
}

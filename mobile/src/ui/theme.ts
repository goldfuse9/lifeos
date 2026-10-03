import type { AppSettings } from '@/domain/types';

/**
 * Vizuální tokeny převzaté z desek plátna (objekt `ui` v renderVals).
 * Čtyři režimy pozadí jsou ty z plátna; výchozí je „čiré sklo“.
 */

export const C = {
  ink: '#17161A',
  ink2: '#2E2D33',
  ink3: '#3A3840',
  muted: '#514F57',
  faint: '#B9B7BD',
  line: '#EEEEEC',
  lineSoft: '#F0EFED',
  field: '#F3F3F2',
  chip: '#F7F7F6',
  white: '#FFFFFF',
  lime: '#D7F23A',
  pink: '#EE3F7A',
  orange: '#F7931E',
  orangeInk: '#7A4300',
  orangeTint: '#FFF1E0',
  orangeLine: '#F7B56A',
  warnBg: '#FFF4E6',
  danger: '#D92D20',
  dangerTint: '#FDECEA',
  ok: '#17694F',
  okTint: '#E0F5EC',
  okDot: '#2E9E6B',
  purple: '#9B3FE0',
};

export const F = {
  regular: 'PlusJakartaSans_400Regular',
  semibold: 'PlusJakartaSans_600SemiBold',
};

export interface Ui {
  glass: boolean;
  bg: string;
  bgRgb: string;
  blobs: [string, string, string, string];
  card: string;
  cardW: string;
  line: string;
  tile: string;
  tileLine: string;
  shadow: string;
  pill: string;
  seg: string;
  rule: string;
}

export function uiFor(mode: AppSettings['background']): Ui {
  if (mode === 'bílé') {
    return {
      glass: false, bg: '#FFFFFF', bgRgb: '255,255,255', blobs: ['transparent', 'transparent', 'transparent', 'transparent'],
      card: '#F7F7F6', cardW: '#FFFFFF', line: '#EEEEEC', tile: '#F2F2F1', tileLine: '#EEEEEC',
      shadow: 'none', pill: '#F4F4F3', seg: '#E6E5E2', rule: '#EEEEEC',
    };
  }
  const cool = mode === 'chladné sklo';
  const cire = mode === 'čiré sklo';
  const bgRgb = cire ? '252,251,250' : cool ? '242,243,246' : '244,243,240';
  return {
    glass: true,
    bg: `rgb(${bgRgb})`,
    bgRgb,
    blobs: [
      cire ? 'rgba(247,179,199,0.16)' : cool ? 'rgba(178,204,250,0.60)' : 'rgba(247,179,199,0.55)',
      cire ? 'rgba(215,242,58,0.10)' : cool ? 'rgba(170,232,214,0.40)' : 'rgba(215,242,58,0.22)',
      cire ? 'rgba(200,170,245,0.12)' : cool ? 'rgba(196,172,246,0.42)' : 'rgba(200,170,245,0.34)',
      cire ? 'rgba(251,206,160,0.16)' : cool ? 'rgba(214,226,252,0.70)' : 'rgba(251,206,160,0.42)',
    ],
    card: cire ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.56)',
    cardW: cire ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.56)',
    line: cire ? 'rgba(23,22,26,0.055)' : 'rgba(255,255,255,0.88)',
    tile: cire ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.44)',
    tileLine: cire ? 'rgba(23,22,26,0.05)' : 'rgba(255,255,255,0.8)',
    shadow: cire ? '0px 6px 20px rgba(40,38,48,0.055)' : '0px 10px 30px rgba(70,56,90,0.06)',
    pill: cire ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.64)',
    seg: '#FFFFFF',
    rule: 'rgba(23,22,26,0.07)',
  };
}

/** Avatary karet — první čtyři jsou z plátna. */
export const AVATARS: [string, string][] = [
  ['#FFE9D2', '#F8CFA6'],
  ['#E6EEFC', '#C9D8F6'],
  ['#E2F5F9', '#BFE6EF'],
  ['#F3E9FD', '#DEC8F7'],
  ['#E7F6D5', '#C9E8A6'],
  ['#FCE4EE', '#F5C2D6'],
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const ME_STYLES = {
  limetková: {
    stops: ['#D7F23A', '#C6E82E', '#E6F7A0'] as const,
    fg: C.ink,
    border: 'rgba(255,255,255,0.4)',
    ring: 'rgba(23,22,26,0.18)',
    shadow: '0px 12px 32px rgba(160,200,20,0.45)',
  },
  černá: {
    stops: ['#17161A', '#17161A', '#17161A'] as const,
    fg: '#FFFFFF',
    border: 'rgba(255,255,255,0.08)',
    ring: 'rgba(255,255,255,0.25)',
    shadow: '0px 12px 32px rgba(0,0,0,0.28)',
  },
};

/** Spodní odstup obsahu kvůli plovoucím tlačítkům. */
export const FAB_SPACE = 128;

import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Ikony přenesené z desek (stejné cesty SVG, stejná tloušťka tahu).
 */

type P = { size?: number; color?: string; width?: number };

const S = ({ size = 20, color = '#17161A', width = 2, children }: P & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const IconBack = (p: P) => <S {...p}><Path d="M15 5l-7 7 7 7" /></S>;
export const IconChevron = (p: P) => <S {...p}><Path d="M9 5l7 7-7 7" /></S>;
export const IconChevronDown = (p: P) => <S {...p}><Path d="M6 9l6 6 6-6" /></S>;
export const IconSearch = (p: P) => <S {...p}><Circle cx="11" cy="11" r="6.5" /><Path d="m20 20-4-4" /></S>;
export const IconClose = (p: P) => <S {...p}><Path d="M6 6l12 12M18 6 6 18" /></S>;
export const IconPlus = (p: P) => <S {...p}><Path d="M12 5v14M5 12h14" /></S>;
export const IconCamera = (p: P) => <S {...p}><Path d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle cx="12" cy="13" r="3.5" /></S>;
export const IconImage = (p: P) => <S {...p}><Rect x="3" y="5" width="18" height="14" rx="3" /><Circle cx="9" cy="10" r="1.6" /><Path d="m21 16-5-5-8 8" /></S>;
export const IconFile = (p: P) => <S {...p}><Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><Path d="M14 3v5h5" /></S>;
export const IconClip = (p: P) => <S {...p}><Path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" /></S>;
export const IconTrash = (p: P) => <S {...p}><Path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></S>;
export const IconEdit = (p: P) => <S {...p}><Path d="M4 20h4L19 9l-4-4L4 16z" /><Path d="M13.5 6.5l4 4" /></S>;
export const IconCalendar = (p: P) => <S {...p}><Rect x="4" y="5" width="16" height="15" rx="3" /><Path d="M4 10h16M9 3v4M15 3v4" /></S>;
export const IconPhone = (p: P) => <S {...p}><Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></S>;
export const IconShield = (p: P) => <S {...p}><Path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" /></S>;
export const IconLock = (p: P) => <S {...p}><Rect x="5" y="11" width="14" height="10" rx="2.5" /><Path d="M8 11V8a4 4 0 0 1 8 0v3" /></S>;
export const IconFace = (p: P) => <S {...p}><Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><Path d="M9 9.5v1M15 9.5v1M12 9v4h-1M9.5 15.5c1.5 1 3.5 1 5 0" /></S>;
export const IconFingerprint = (p: P) => <S {...p}><Path d="M12 11v3a8 8 0 0 1-1.5 4.5M8.5 8.5A5 5 0 0 1 17 12v1.5M7 12a5 5 0 0 1 .5-2.2M14.5 16.5c-.3 1.3-.8 2.5-1.5 3.5M5 15c.5-1 .9-2 1-3M19.5 12A7.5 7.5 0 0 0 6 7.5" /></S>;
export const IconExport = (p: P) => <S {...p}><Path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></S>;
export const IconCheck = (p: P) => <S {...p}><Path d="M5 12.5l4.5 4.5L19 7.5" /></S>;
export const IconWarn = (p: P) => <S {...p}><Path d="M12 4 2.5 20h19z" /><Path d="M12 10v4M12 17.2v.1" /></S>;
export const IconFilter = (p: P) => <S {...p}><Path d="M4 6h16M7 12h10M10 18h4" /></S>;

export const IconMoodFab = (p: P) => (
  <S {...p} width={1.9}>
    <Circle cx="12" cy="12" r="8.5" />
    <Path d="M8.5 14c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" />
    <Circle cx="9.3" cy="10" r="0.6" fill={p.color} />
    <Circle cx="14.7" cy="10" r="0.6" fill={p.color} />
  </S>
);

/** Ikony typů záznamů z osy (15 px, tah 1,8). */
export function TypeGlyph({ type, size = 15, color, mouth }: { type: string; size?: number; color: string; mouth?: string }) {
  const p = { size, color, width: 1.8 };
  switch (type) {
    case 'symptom':
      return <S {...p}><Path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z" /><Path d="M12 10v7" /></S>;
    case 'visit':
      return <S {...p}><Path d="M6 3v6a4 4 0 0 0 8 0V3" /><Path d="M10 13v2a5 5 0 0 0 10 0v-2" /><Circle cx="20" cy="11" r="2" /></S>;
    case 'result':
      return <S {...p}><Path d="M9 3h6" /><Path d="M10 3v6.5L5 18a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3L14 9.5V3" /><Path d="M7.5 15h9" /></S>;
    case 'med':
      return <S {...p}><Rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-45 12 12.5)" /><Path d="M9.5 10l4.5 4.5" /></S>;
    case 'doc':
      return <S {...p}><Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><Path d="M14 3v5h5" /><Path d="M9 13h6M9 17h4" /></S>;
    case 'note':
      return <S {...p}><Path d="M4 20h4L19 9l-4-4L4 16z" /><Path d="M13.5 6.5l4 4" /></S>;
    case 'event':
      return <S {...p}><Rect x="4" y="5" width="16" height="15" rx="3" /><Path d="M4 10h16M9 3v4M15 3v4" /></S>;
    case 'mood':
    default:
      return (
        <S {...p} size={size + 1}>
          <Circle cx="12" cy="12" r="9" />
          <Circle cx="9" cy="10" r="0.9" fill={color} />
          <Circle cx="15" cy="10" r="0.9" fill={color} />
          <Path d={mouth || 'M8.6 14.4c1 .9 2.1 1.3 3.4 1.3s2.4-.4 3.4-1.3'} />
        </S>
      );
  }
}

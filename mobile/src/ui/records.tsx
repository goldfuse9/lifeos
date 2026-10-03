import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import type { Attachment, HcRecord } from '@/domain/types';
import { MOODS, RECORD_TYPES } from '@/domain/recordTypes';
import { recordSubtitle } from '@/domain/timeline';
import { formatSize } from '@/domain/dates';
import { C } from './theme';
import { T, useUi } from './kit';
import { IconFile, IconImage, TypeGlyph } from './icons';

/** Kroužek s ikonou typu (28 px) z osy. */
export function TypeDot({ r, size = 28 }: { r: Pick<HcRecord, 'type' | 'metadata'>; size?: number }) {
  const t = RECORD_TYPES[r.type];
  const mouth = r.type === 'mood' && r.metadata.mood != null ? MOODS[r.metadata.mood]?.mouth : undefined;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
      <TypeGlyph type={r.type} color={t.color} mouth={mouth} size={Math.round(size * 0.54)} />
    </View>
  );
}

const BADGE = { ok: { bg: C.okTint, fg: C.ok }, warn: { bg: '#FDF1DA', fg: '#7A4F00' } };

/**
 * Karta záznamu v ose — přesně podle Mix.dc.html: barevný typ, odznak,
 * nadpis, podtitul, rámeček s podzáznamy a přílohy jako „pilulky“.
 */
export function RecordCard({ r, files, onPress, onOpenFile }: { r: HcRecord; files?: Attachment[]; onPress: () => void; onOpenFile?: (a: Attachment) => void }) {
  const ui = useUi();
  const t = RECORD_TYPES[r.type];
  const sub = recordSubtitle(r);
  const m = r.metadata || {};
  const badge = m.badge ? BADGE[m.badgeTone === 'warn' ? 'warn' : 'ok'] : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.label}: ${r.title}${r.time ? ', ' + r.time : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, minWidth: 0, marginRight: 16, paddingVertical: 10, paddingLeft: 10, paddingRight: 14,
        backgroundColor: pressed ? ui.cardW : ui.card, borderWidth: 1, borderColor: ui.line, borderRadius: 18, boxShadow: ui.shadow,
      })}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <TypeDot r={r} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <T w="semibold" style={{ fontSize: 12, lineHeight: 16, color: t.text }}>{t.label}</T>
            {badge ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: badge.bg }}>
                <T w="semibold" style={{ fontSize: 12, lineHeight: 16, color: badge.fg }}>{m.badge}</T>
              </View>
            ) : null}
          </View>
          <T w="semibold" style={{ marginTop: 2, fontSize: 16, lineHeight: 22, letterSpacing: -0.16 }}>{r.title}</T>
          {sub ? <T style={{ marginTop: 2, fontSize: 14, lineHeight: 20, color: C.muted }} numberOfLines={3}>{sub}</T> : null}
        </View>
      </View>
      {m.children && m.children.length ? (
        <View style={{ marginTop: 10, marginLeft: 40, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, gap: 8 }}>
          {m.children.map((c, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 8, height: 8, marginTop: 6, borderRadius: 4, backgroundColor: RECORD_TYPES[c.type]?.color ?? C.muted }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={{ fontSize: 12, lineHeight: 16, color: C.muted }}>{c.label}</T>
                <T style={{ fontSize: 14, lineHeight: 20 }}>{c.value}</T>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {files && files.length ? (
        <View style={{ marginTop: 8, marginLeft: 40, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {files.map((f) => (
            <FileChip key={f.id} a={f} onPress={onOpenFile ? () => onOpenFile(f) : undefined} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export function FileChip({ a, onPress }: { a: Attachment; onPress?: () => void }) {
  const meta = (a.kind === 'pdf' ? 'PDF · ' : '') + formatSize(a.size);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Otevřít soubor ' + a.name}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 22, maxWidth: '100%', opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FDECE6', alignItems: 'center', justifyContent: 'center' }}>
        {a.kind === 'photo' ? <IconImage size={15} color="#E0613B" width={1.8} /> : <IconFile size={15} color="#E0613B" width={1.8} />}
      </View>
      <View style={{ flexShrink: 1 }}>
        <T w="semibold" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>{a.name}</T>
        <T style={{ fontSize: 12, lineHeight: 16, color: C.muted }}>{meta}</T>
      </View>
    </Pressable>
  );
}

/** Náhled přílohy: fotka jako obrázek, ostatní jako „papír“ z desky Dokumenty. */
export function AttachmentPreview({ a, uri, height = 124, width = 100, tilt = 0, stamp }: { a: Attachment; uri: string; height?: number; width?: number; tilt?: number; stamp?: string }) {
  if (a.kind === 'photo') {
    return (
      <View style={{ width: width + 12, height, borderRadius: 12, borderWidth: 5, borderColor: C.white, backgroundColor: '#E9E7E4', boxShadow: '0px 10px 24px rgba(40,40,40,0.10)', overflow: 'hidden', transform: [{ rotate: tilt + 'deg' }] }}>
        <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" accessibilityIgnoresInvertColors />
      </View>
    );
  }
  return (
    <View style={{ width, height, borderRadius: 10, backgroundColor: C.white, paddingVertical: 12, paddingHorizontal: 10, gap: 5, boxShadow: '0px 10px 24px rgba(40,40,40,0.09)', transform: [{ rotate: tilt + 'deg' }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 28, height: 1, backgroundColor: C.faint }} />
        <T style={{ fontSize: 6, letterSpacing: 1.2, color: C.muted }}>{stamp ?? (a.kind === 'pdf' ? 'PDF' : 'SOUBOR')}</T>
      </View>
      {[30, 56, 44, 0, 62, 38].map((w, i) =>
        w ? <View key={i} style={{ width: w, height: 3, borderRadius: 2, backgroundColor: '#E6E5E2', marginTop: i === 0 ? 8 : 0 }} /> : <View key={i} style={{ height: 1, backgroundColor: C.line, marginTop: 4 }} />,
      )}
    </View>
  );
}

import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useData, useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { formatSize, numericDate } from '@/domain/dates';
import { Loading, T, useToast } from '@/ui/kit';
import { AttachmentPreview } from '@/ui/records';
import { confirm, openExternally } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconClose, IconExport, IconTrash } from '@/ui/icons';

/**
 * Příloha přes celou obrazovku. Fotky se zobrazí přímo, PDF a ostatní
 * soubory se otevřou v systémovém prohlížeči (nabídka „Otevřít v…“).
 */
export default function AttachmentViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useData();
  const { touch } = useSession();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [zoom, setZoom] = useState(false);

  const { value, loading } = useLoad(async () => {
    const a = await data.attachments.get(String(id));
    if (!a) return null;
    const r = await data.records.get(a.recordId);
    return { a, r, available: data.files.available(a) };
  }, [id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (loading && value === undefined) return <View style={{ flex: 1, backgroundColor: '#111' }}><Loading /></View>;
  if (!value) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111', paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
        <CloseBtn onPress={close} />
        <T style={{ color: C.white, marginTop: 24, fontSize: 16 }}>Příloha už neexistuje.</T>
      </View>
    );
  }

  const { a, r, available } = value;
  const uri = data.files.uri(a);

  const open = async () => {
    if (!available) return toast('Soubor v telefonu chybí.');
    const ok = await openExternally(uri, a.mimeType, a.name);
    if (!ok) toast('Tento telefon neumí soubor otevřít.');
  };

  const remove = async () => {
    if (!(await confirm('Smazat přílohu?', a.name, 'Smazat'))) return;
    await data.files.remove(a.id);
    touch();
    toast('Příloha smazána');
    close();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#111' }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CloseBtn onPress={close} />
        <View style={{ flex: 1 }}>
          <T w="semibold" numberOfLines={1} style={{ color: C.white, fontSize: 16 }}>{a.name}</T>
          <T style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{[r ? numericDate(r.date) : null, formatSize(a.size)].filter(Boolean).join(' · ')}</T>
        </View>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {!available ? (
          <T style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center', paddingHorizontal: 32 }}>Soubor v telefonu chybí. Mohl být smazán mimo aplikaci.</T>
        ) : a.kind === 'photo' ? (
          zoom ? (
            <ScrollView maximumZoomScale={4} minimumZoomScale={1} centerContent style={{ alignSelf: 'stretch' }} contentContainerStyle={{ flexGrow: 1 }}>
              <Pressable onPress={() => setZoom(false)} style={{ flex: 1 }}>
                <Image source={{ uri }} style={{ flex: 1, minHeight: 500 }} contentFit="contain" accessibilityLabel={a.name} />
              </Pressable>
            </ScrollView>
          ) : (
            <Pressable onPress={() => setZoom(true)} style={{ alignSelf: 'stretch', flex: 1 }} accessibilityHint="Klepnutím přiblížíte">
              <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" accessibilityLabel={a.name} />
            </Pressable>
          )
        ) : (
          <Pressable accessibilityRole="button" onPress={open} style={{ alignItems: 'center', gap: 20 }}>
            <AttachmentPreview a={a} uri={uri} width={150} height={190} />
            <T w="semibold" style={{ color: C.white, fontSize: 15 }}>{a.kind === 'pdf' ? 'Otevřít PDF' : 'Otevřít soubor'}</T>
          </Pressable>
        )}
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 12, flexDirection: 'row', gap: 10 }}>
        {r ? (
          <DarkBtn label="Záznam" onPress={() => router.replace(`/zaznam/${r.id}`)} />
        ) : null}
        <DarkBtn label={a.kind === 'photo' ? 'Sdílet…' : 'Otevřít v…'} onPress={open} icon={<IconExport size={16} color={C.white} />} />
        <DarkBtn label="Smazat" onPress={remove} icon={<IconTrash size={16} color="#FF8A80" />} danger />
      </View>
    </View>
  );
}

function CloseBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Zavřít" onPress={onPress} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
      <IconClose size={18} color={C.white} />
    </Pressable>
  );
}

function DarkBtn({ label, onPress, icon, danger }: { label: string; onPress: () => void; icon?: React.ReactNode; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
      {icon}
      <T w="semibold" style={{ color: danger ? '#FF8A80' : C.white, fontSize: 14 }}>{label}</T>
    </Pressable>
  );
}

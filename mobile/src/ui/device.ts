import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import type { PickedFile } from '@/services/attachments';
import { withLockHold } from '@/state/session';

/**
 * Výběr souborů ze zařízení: vyfotit, vybrat z fotek, vybrat soubor.
 * Vrací se seznam (fotky i soubory jdou vybrat víc najednou).
 */

export type Source = 'camera' | 'library' | 'file';

export function pickFrom(source: Source): Promise<PickedFile[]> {
  return withLockHold(() => pickFromInner(source));
}

async function pickFromInner(source: Source): Promise<PickedFile[]> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Fotoaparát není povolený', 'Povolte LifeOS přístup k fotoaparátu v nastavení telefonu.');
      return [];
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
    if (r.canceled) return [];
    return r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName || `Foto ${new Date().toLocaleDateString('cs-CZ')}${i ? ' ' + (i + 1) : ''}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null }));
  }
  if (source === 'library') {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 10, exif: false });
    if (r.canceled) return [];
    return r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName || `Fotka ${i + 1}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null }));
  }
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*', '*/*'], multiple: true, copyToCacheDirectory: true });
  if (r.canceled) return [];
  return r.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? null, size: a.size ?? null }));
}

/** Nabídka zdroje — nativní action sheet na iOS, dialog na Androidu. */
export function chooseSource(title: string): Promise<Source | null> {
  const opts: [Source, string][] = [
    ['camera', 'Vyfotit'],
    ['library', 'Vybrat z fotek'],
    ['file', 'Vybrat soubor (PDF, obrázek…)'],
  ];
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, options: [...opts.map((o) => o[1]), 'Zrušit'], cancelButtonIndex: opts.length },
        (i) => resolve(i < opts.length ? opts[i][0] : null),
      );
    } else {
      Alert.alert(title, undefined, [...opts.map(([k, l]) => ({ text: l, onPress: () => resolve(k) })), { text: 'Zrušit', style: 'cancel' as const, onPress: () => resolve(null) }], {
        cancelable: true,
        onDismiss: () => resolve(null),
      });
    }
  });
}

/**
 * Otevře soubor v systémovém prohlížeči / nabídce „Otevřít v…“.
 * Fotky se zobrazují přímo v aplikaci (obrazovka přílohy); tohle je pro PDF
 * a ostatní typy, které aplikace sama nevykreslí.
 */
export async function openExternally(uri: string, mimeType: string, name: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await withLockHold(() => Sharing.shareAsync(uri, { mimeType, dialogTitle: name, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined }));
  return true;
}

export function confirm(title: string, message: string, ok: string, destructive = true): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Zrušit', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { useSession, withLockHold } from '@/state/session';
import { useNow } from '@/state/useLoad';
import { AuthError } from '@/services/auth';
import { cacheBytes, removeCacheFile } from '@/platform/files';
import { toLocalDate } from '@/domain/dates';
import { Backdrop, Card, Field, Note, PrimaryButton, T, TopBar, useToast } from '@/ui/kit';
import { C } from '@/ui/theme';
import { IconCheck, IconWarn } from '@/ui/icons';

/**
 * Záloha — jeden zašifrovaný soubor se vším (karty, záznamy, soubory).
 * Uloží se přes systémové sdílení: do Souborů, na iCloud, e-mailem sobě.
 */
export default function Zaloha() {
  const s = useSession();
  const toast = useToast();
  const now = useNow();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const last = s.settings.lastBackupAt ? new Date(s.settings.lastBackupAt) : null;
  const old = !last || now.getTime() - last.getTime() > 30 * 86400_000;

  const create = async () => {
    if (!pw) return;
    setBusy(true);
    setErr(null);
    const name = `LifeOS-zaloha-${toLocalDate(new Date())}.lifeos`;
    try {
      const bytes = await s.createBackup(pw);
      setPw('');
      const uri = cacheBytes(name, bytes);
      if (await Sharing.isAvailableAsync()) {
        await withLockHold(() => Sharing.shareAsync(uri, { mimeType: 'application/octet-stream', dialogTitle: 'Uložit zálohu LifeOS', UTI: 'public.data' }));
        await s.updateSettings({ lastBackupAt: new Date().toISOString() });
        toast('Záloha vytvořena');
      } else {
        toast('Sdílení není v tomto telefonu dostupné.');
      }
    } catch (e) {
      setErr(e instanceof AuthError ? (e.code === 'locked' ? 'Příliš mnoho pokusů, zkuste to za chvíli.' : 'Heslo nesedí.') : 'Zálohu se nepodařilo vytvořit.');
    } finally {
      removeCacheFile(name);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title="Záloha" backLabel="Zpět do nastavení" />

        <View accessibilityRole="text" style={{ marginTop: 18, padding: 12, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: old ? 'rgba(247,147,30,0.09)' : 'rgba(46,158,107,0.09)', borderWidth: 1, borderColor: old ? 'rgba(247,147,30,0.24)' : 'rgba(46,158,107,0.22)' }}>
          {old ? <IconWarn size={16} color={C.orangeInk} /> : <IconCheck size={16} color="#125742" />}
          <T w="semibold" style={{ flex: 1, fontSize: 13, color: old ? C.orangeInk : '#125742' }}>
            {last ? 'Poslední záloha ' + last.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Zatím žádná záloha — při ztrátě telefonu by data zmizela'}
          </T>
        </View>

        <Card style={{ marginTop: 12, padding: 16, gap: 14 }}>
          <T style={{ fontSize: 15, lineHeight: 22 }}>Všechny karty, záznamy a soubory v jednom souboru, zašifrovaném heslem účtu.</T>
          <Field label="Heslo k účtu" value={pw} onChangeText={setPw} secureTextEntry textContentType="password" returnKeyType="done" onSubmitEditing={create} error={err} />
          <PrimaryButton label={busy ? 'Šifruji…' : 'Vytvořit zálohu'} onPress={create} busy={busy} disabled={!pw} />
        </Card>

        <Note style={{ marginTop: 16 }}>
          Soubor uložte mimo telefon — do Souborů na iCloud nebo si ho pošlete. Obnovíte ho po instalaci na úvodní obrazovce tlačítkem „Obnovit ze zálohy“. Otevře se heslem, které platilo při zálohování.
        </Note>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

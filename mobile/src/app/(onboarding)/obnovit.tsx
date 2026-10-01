import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSession, withLockHold } from '@/state/session';
import { BackupError, readBackupHeader } from '@/services/backup';
import { AuthError } from '@/services/auth';
import { readUri } from '@/platform/files';
import { Backdrop, Card, Field, H1, Muted, Note, PrimaryButton, T, TopBar, useScreenInsets } from '@/ui/kit';
import { BioStep } from '@/ui/BioStep';
import { C } from '@/ui/theme';
import { IconFile } from '@/ui/icons';

/**
 * Obnova ze zálohy — vybrat soubor .lifeos a zadat heslo, se kterým
 * záloha vznikla. Vznikne stejný účet se všemi kartami a soubory.
 */
export default function Obnovit() {
  const s = useSession();
  const ins = useScreenInsets();
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; date: string } | null>(null);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (s.status === 'onboarding') return <BioStep restored />;

  const pick = async () => {
    setErr(null);
    const r = await withLockHold(() => DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true }));
    if (r.canceled || !r.assets[0]) return;
    try {
      const bytes = await readUri(r.assets[0].uri);
      const h = readBackupHeader(bytes);
      setFile({ name: r.assets[0].name, bytes, date: new Date(h.createdAt).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) });
    } catch (e) {
      setFile(null);
      setErr(e instanceof BackupError ? e.message : 'Soubor nejde přečíst.');
    }
  };

  const restore = async () => {
    if (!file || !pw) return;
    setBusy(true);
    setErr(null);
    try {
      await s.restoreFromBackup(file.bytes, pw);
    } catch (e) {
      setErr(e instanceof BackupError || e instanceof AuthError ? e.message : 'Obnova se nepovedla.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: 40 }}>
        <TopBar />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Obnovit ze zálohy</H1>
          <Muted style={{ marginTop: 4 }}>Soubor .lifeos a heslo, se kterým záloha vznikla.</Muted>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={pick}
          style={({ pressed }) => ({ marginTop: 16, minHeight: 72, padding: 14, borderRadius: 22, borderWidth: 1.5, borderStyle: file ? 'solid' : 'dashed', borderColor: file ? '#9FD3B5' : '#DCDAD6', backgroundColor: file ? '#EAF6EE' : 'rgba(255,255,255,0.7)', flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 })}
        >
          <IconFile size={22} color={file ? '#17694F' : C.muted} />
          <View style={{ flex: 1 }}>
            <T w="semibold" numberOfLines={1} style={{ fontSize: 15, color: file ? '#17694F' : C.ink }}>{file ? file.name : 'Vybrat soubor zálohy'}</T>
            <T style={{ fontSize: 13, color: file ? '#17694F' : C.muted }}>{file ? 'Záloha z ' + file.date : 'Ze Souborů, iCloudu nebo e-mailu'}</T>
          </View>
        </Pressable>

        {file ? (
          <Card style={{ marginTop: 12, padding: 16 }}>
            <Field label="Heslo ze zálohy" value={pw} onChangeText={setPw} secureTextEntry textContentType="password" returnKeyType="done" onSubmitEditing={restore} />
          </Card>
        ) : null}

        {err ? <T style={{ marginTop: 12, color: C.danger, fontSize: 14 }}>{err}</T> : null}
        {file ? <PrimaryButton style={{ marginTop: 20 }} label={busy ? 'Obnovuji…' : 'Obnovit'} onPress={restore} busy={busy} disabled={!pw} /> : null}

        <Note style={{ marginTop: 16 }}>Heslo se stane heslem účtu v tomto telefonu. Bez něj zálohu otevřít nejde.</Note>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

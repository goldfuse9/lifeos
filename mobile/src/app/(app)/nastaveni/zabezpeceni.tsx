import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSession } from '@/state/session';
import { AuthError, passwordProblem } from '@/services/auth';
import { Backdrop, Card, Chip, Divider, Field, H1, Muted, Note, PrimaryButton, SecondaryButton, T, ToggleRow, TopBar, useToast } from '@/ui/kit';
import { confirm } from '@/ui/device';
import { C } from '@/ui/theme';

/**
 * Přihlášení a zabezpečení: biometrie, automatický zámek, změna hesla,
 * smazání všeho z telefonu.
 */

const LOCKS: [number, string][] = [[0, 'Hned'], [60, 'Po 1 min'], [300, 'Po 5 min'], [900, 'Po 15 min']];

export default function Zabezpeceni() {
  const s = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<'none' | 'bio' | 'pw'>('none');
  const [pw, setPw] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwNew2, setPwNew2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const bioReady = !!s.bio?.available && !!s.bio?.enrolled;
  const bioLabel = s.bio?.label ?? 'biometrie';

  const reset = () => {
    setMode('none');
    setPw('');
    setPwNew('');
    setPwNew2('');
    setErr(null);
  };

  const toggleBio = async (v: boolean) => {
    if (!v) {
      await s.disableBiometric();
      toast(bioLabel + ' vypnuto');
      return;
    }
    setMode('bio');
    setErr(null);
  };

  const confirmBio = async () => {
    setBusy(true);
    setErr(null);
    try {
      await s.enableBiometric(pw);
      toast(bioLabel + ' zapnuto');
      reset();
    } catch (e) {
      setErr(e instanceof AuthError ? (e.code === 'locked' ? 'Příliš mnoho pokusů. Zkuste to později.' : 'Heslo nesedí.') : 'Nepodařilo se zapnout.');
    } finally {
      setBusy(false);
    }
  };

  const changePw = async () => {
    setErr(null);
    const p = passwordProblem(pwNew);
    if (p) return setErr(p);
    if (pwNew !== pwNew2) return setErr('Nová hesla se neshodují.');
    setBusy(true);
    try {
      await s.changePassword(pw, pwNew);
      toast('Heslo změněno');
      reset();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Heslo se nepodařilo změnit.');
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    const ok = await confirm('Smazat vše z tohoto telefonu?', 'Smaže se účet, všechny karty, záznamy a soubory. Nejde to vrátit. Pokud chcete data zachovat, nejdřív si je stáhněte (Vzít si svoje data).', 'Pokračovat');
    if (!ok) return;
    const sure = await confirm('Opravdu?', 'Toto je poslední krok.', 'Smazat vše');
    if (sure) await s.wipeEverything();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>Zabezpečení</H1>
        <Muted style={{ paddingLeft: 8, marginTop: 4 }}>Data jsou zašifrovaná a otevřou se jen po odemknutí.</Muted>

        <Card style={{ marginTop: 16, overflow: 'hidden' }}>
          <ToggleRow
            title={'Odemykat přes ' + bioLabel}
            sub={bioReady ? 'Heslo zůstává jako záloha' : 'V telefonu není nastavená biometrie'}
            value={s.settings.biometricEnabled}
            onChange={toggleBio}
            disabled={!bioReady && !s.settings.biometricEnabled}
          />
          {mode === 'bio' ? (
            <View style={{ padding: 14, paddingTop: 0, gap: 10 }}>
              <Field label="Potvrďte heslem" value={pw} onChangeText={setPw} secureTextEntry autoFocus textContentType="password" onSubmitEditing={confirmBio} />
              {err ? <T style={{ color: C.danger, fontSize: 13 }}>{err}</T> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <SecondaryButton label="Zrušit" onPress={reset} style={{ flex: 1, minHeight: 48 }} />
                <PrimaryButton label="Zapnout" onPress={confirmBio} disabled={!pw} busy={busy} style={{ flex: 2, minHeight: 48 }} />
              </View>
            </View>
          ) : null}
          <Divider />
          <View style={{ padding: 14, gap: 8 }}>
            <T w="semibold" style={{ fontSize: 15 }}>Zamknout po odchodu z aplikace</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {LOCKS.map(([sec, label]) => (
                <Chip key={sec} label={label} selected={s.settings.autoLockSeconds === sec} onPress={() => s.updateSettings({ autoLockSeconds: sec })} />
              ))}
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: 16, padding: 14, gap: 12 }}>
          <T w="semibold" style={{ fontSize: 15 }}>Změnit heslo</T>
          {mode === 'pw' ? (
            <>
              <Field label="Současné heslo" value={pw} onChangeText={setPw} secureTextEntry textContentType="password" autoFocus />
              <Field label="Nové heslo" value={pwNew} onChangeText={setPwNew} secureTextEntry textContentType="newPassword" hint="Aspoň 8 znaků." />
              <Field label="Nové heslo znovu" value={pwNew2} onChangeText={setPwNew2} secureTextEntry textContentType="newPassword" />
              {err ? <T style={{ color: C.danger, fontSize: 13 }}>{err}</T> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <SecondaryButton label="Zrušit" onPress={reset} style={{ flex: 1, minHeight: 48 }} />
                <PrimaryButton label="Změnit" onPress={changePw} disabled={!pw || !pwNew} busy={busy} style={{ flex: 2, minHeight: 48 }} />
              </View>
            </>
          ) : (
            <SecondaryButton label="Změnit heslo" onPress={() => { reset(); setMode('pw'); }} />
          )}
        </Card>

        <Note style={{ marginTop: 16 }}>
          Heslo se nikde neukládá — z něj se odvozuje klíč k datům. Když ho zapomenete a nemáte zapnutou biometrii, data nepůjde otevřít.
        </Note>

        <SecondaryButton style={{ marginTop: 28 }} danger label="Smazat vše z tohoto telefonu" onPress={wipe} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

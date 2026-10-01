import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSession } from '@/state/session';
import { AuthError } from '@/services/auth';
import { vocative } from '@/domain/dates';
import { Backdrop, Card, Field, H1, LinkButton, Muted, PrimaryButton, SecondaryButton, T, useScreenInsets } from '@/ui/kit';
import { Wordmark } from '@/ui/Wordmark';
import { confirm } from '@/ui/device';
import { C } from '@/ui/theme';
import { IconFace, IconFingerprint } from '@/ui/icons';

/**
 * Odemknutí. Pokud je zapnutá biometrie, nabídne se hned po otevření;
 * heslo je vždy po ruce jako záloha.
 */
export default function Login() {
  const s = useSession();
  const ins = useScreenInsets();
  const [email, setEmail] = useState(s.account?.email ?? '');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [bioOn, setBioOn] = useState(false);
  const autoTried = useRef(false);

  const tryBio = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      await s.loginBiometric();
    } catch (e) {
      if (e instanceof AuthError && e.code === 'bio_unavailable') setBioOn(false);
      else setErr('Odemknutí se nepovedlo. Zkuste to znovu nebo zadejte heslo.');
    } finally {
      setBusy(false);
    }
  }, [s]);

  useEffect(() => {
    // Biometrii nabídnout, jen když ji telefon umí A účet ji má zapnutou.
    // Příznak je v Keychainu, protože databáze je v tuhle chvíli zamčená.
    let alive = true;
    (async () => {
      const can = !!s.bio?.available && !!s.bio?.enrolled && (await s.auth.biometricEnabled());
      if (!alive) return;
      setBioOn(can);
      if (can && !autoTried.current) {
        autoTried.current = true;
        tryBio();
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.bio]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1000)), 1000);
    return () => clearInterval(t);
  }, [wait > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!pw || busy || wait > 0) return;
    setErr(null);
    setBusy(true);
    try {
      await s.loginPassword(email, pw);
    } catch (e) {
      setPw('');
      if (e instanceof AuthError) {
        setErr(e.code === 'locked' ? 'Příliš mnoho pokusů. Počkejte chvíli.' : e.message);
        if (e.retryAfterMs) setWait(e.retryAfterMs);
      } else setErr('Data se nepodařilo otevřít.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    const ok = await confirm(
      'Zapomenuté heslo',
      'Data jsou zašifrovaná heslem a nikde jinde nejsou uložená, takže heslo nejde obnovit. Pokud máte zapnutou biometrii, odemkněte přes ni a heslo si v nastavení změňte.\n\nJinak zbývá jen smazat vše z tohoto telefonu a začít znovu.',
      'Smazat vše a začít znovu',
    );
    if (!ok) return;
    const sure = await confirm('Opravdu smazat?', 'Smažou se všechny karty, záznamy a soubory v tomto telefonu. Nejde to vrátit.', 'Smazat');
    if (sure) await s.wipeEverything();
  };

  const name = s.account?.name ?? '';
  const secs = Math.ceil(wait / 1000);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 }}>
        <View style={{ height: 44, justifyContent: 'center', paddingLeft: 6 }}>
          <Wordmark />
        </View>
        <View style={{ marginTop: 32, alignItems: 'center' }}>
          <T style={{ fontSize: 17, lineHeight: 22, color: C.muted }}>Vítejte zpět,</T>
          <H1 style={{ fontSize: 34, letterSpacing: -1.2, textAlign: 'center' }}>{vocative(name)}</H1>
        </View>

        <Card style={{ marginTop: 24, padding: 16, gap: 14 }}>
          <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="username" />
          <Field label="Heslo" value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
        </Card>

        {err ? <T accessibilityRole="alert" style={{ marginTop: 12, color: C.danger, fontSize: 14 }}>{err}{secs > 0 ? ` (${secs} s)` : ''}</T> : null}

        <View style={{ marginTop: 20, gap: 10 }}>
          <PrimaryButton label={secs > 0 ? `Zkuste to za ${secs} s` : 'Odemknout'} onPress={submit} disabled={!pw || secs > 0} busy={busy} />
          {bioOn ? (
            <SecondaryButton
              label={`Odemknout přes ${s.bio?.label}`}
              onPress={tryBio}
              icon={s.bio?.kind === 'fingerprint' ? <IconFingerprint size={18} color={C.ink} width={1.8} /> : <IconFace size={18} color={C.ink} width={1.8} />}
            />
          ) : null}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <LinkButton label="Zapomněli jste heslo?" onPress={forgot} />
          <Muted style={{ fontSize: 12, textAlign: 'center' }}>Data jsou jen v tomto telefonu a fungují bez internetu.</Muted>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

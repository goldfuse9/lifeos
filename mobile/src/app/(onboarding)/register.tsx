import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type TextInput } from 'react-native';
import { useSession } from '@/state/session';
import { passwordProblem, validateEmail, AuthError } from '@/services/auth';
import { Backdrop, Card, Field, H1, Muted, Note, PrimaryButton, T, TopBar, useScreenInsets } from '@/ui/kit';
import { C } from '@/ui/theme';
import { BioStep } from '@/ui/BioStep';

/**
 * Registrace — čtyři pole, nic navíc. Druhý krok nabídne biometrii.
 */
export default function Register() {
  const s = useSession();
  const ins = useScreenInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);
  const pw2Ref = useRef<TextInput>(null);

  if (s.status === 'onboarding') return <BioStep />;

  const errors = {
    name: !name.trim() ? 'Vyplňte jméno.' : null,
    email: !validateEmail(email) ? 'E-mail nevypadá správně.' : null,
    pw: passwordProblem(pw),
    pw2: pw2 !== pw ? 'Hesla se neshodují.' : null,
  };
  const valid = !errors.name && !errors.email && !errors.pw && !errors.pw2;

  const submit = async () => {
    setTried(true);
    setErr(null);
    if (!valid) return;
    setBusy(true);
    try {
      await s.register({ name, email, password: pw });
    } catch (e) {
      setErr(e instanceof AuthError || e instanceof Error ? e.message : 'Účet se nepodařilo vytvořit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: ins.top, paddingHorizontal: 16, paddingBottom: 40 }}>
        <TopBar />
        <View style={{ marginTop: 18, paddingLeft: 8 }}>
          <H1>Nový účet</H1>
          <Muted style={{ marginTop: 4 }}>Účet je jen v tomto telefonu.</Muted>
        </View>

        <Card style={{ marginTop: 16, padding: 16, gap: 14 }}>
          <Field label="Jméno a příjmení" value={name} onChangeText={setName} autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} error={tried ? errors.name : null} />
          <Field ref={emailRef} label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} error={tried ? errors.email : null} />
          <Field ref={pwRef} label="Heslo" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" textContentType="newPassword" returnKeyType="next" onSubmitEditing={() => pw2Ref.current?.focus()} hint="Aspoň 8 znaků." error={tried ? errors.pw : null} />
          <Field ref={pw2Ref} label="Heslo znovu" value={pw2} onChangeText={setPw2} secureTextEntry autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={submit} error={tried ? errors.pw2 : null} />
        </Card>

        <Note style={{ marginTop: 16 }}>
          Heslo nikam neodchází a nikde se neukládá. Když ho zapomenete a nebudete mít zapnuté odemykání biometrií, data v telefonu nepůjde otevřít.
        </Note>

        {err ? <T style={{ marginTop: 12, color: C.danger, fontSize: 14 }}>{err}</T> : null}
        <PrimaryButton style={{ marginTop: 20 }} label={busy ? 'Šifruji…' : 'Vytvořit účet'} onPress={submit} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useData, usePerson, useSession } from '@/state/session';
import type { EmergencyData } from '@/domain/types';
import { EMERGENCY_FIELDS, PRIO_LABEL } from '@/domain/emergency';
import { Backdrop, Card, Chip, Field, H1, Muted, PrimaryButton, T, TopBar, useToast } from '@/ui/kit';
import { confirm } from '@/ui/device';
import { C } from '@/ui/theme';

/** Nouzové údaje — podle důležitosti, jak je má plátno. */
export default function Nouzove() {
  const data = useData();
  const person = usePerson();
  const { touch } = useSession();
  const toast = useToast();
  const navigation = useNavigation();
  const [e, setE] = useState<EmergencyData | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    data.personData.get(person.id, 'emergency').then(setE);
  }, [data, person.id]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (ev) => {
      if (!dirty.current) return;
      ev.preventDefault();
      confirm('Zahodit změny?', 'Neuložené údaje se ztratí.', 'Zahodit').then((ok) => ok && navigation.dispatch(ev.data.action));
    });
  }, [navigation]);

  if (!e) return <Backdrop />;

  const set = (k: keyof EmergencyData, v: string) => {
    dirty.current = true;
    setE({ ...e, [k]: v });
  };

  const save = async () => {
    setBusy(true);
    try {
      await data.personData.set(person.id, 'emergency', e);
      dirty.current = false;
      touch();
      toast('Nouzové údaje uloženy');
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title={person.name} />
        <H1 style={{ marginTop: 18, paddingLeft: 8 }}>Nouzové údaje</H1>
        <Muted style={{ paddingLeft: 8, marginTop: 4 }}>Ukáží se na nouzové kartě. Stačí vyplnit první tři.</Muted>

        {([1, 2, 3] as const).map((prio) => {
          const [label, color, hint] = PRIO_LABEL[prio];
          return (
            <View key={prio} style={{ marginTop: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                <T w="semibold" style={{ fontSize: 12, color: C.muted }}>{label}</T>
              </View>
              {hint ? <T style={{ fontSize: 13, color: C.muted, paddingHorizontal: 4, marginTop: 2 }}>{hint}</T> : null}
              <Card style={{ marginTop: 8, padding: 16, gap: 14 }}>
                {EMERGENCY_FIELDS.filter((f) => f.prio === prio).map((f) =>
                  f.options ? (
                    <View key={f.k} style={{ gap: 6 }}>
                      <T w="semibold" style={{ fontSize: 13, color: C.muted }}>{f.label}</T>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {f.options.map((o) => (
                          <Chip key={o} label={o} selected={(e[f.k] ?? 'nevím') === o} onPress={() => set(f.k, o === 'nevím' ? '' : o)} />
                        ))}
                      </View>
                    </View>
                  ) : (
                    <Field key={f.k} label={f.label} value={e[f.k] ?? ''} onChangeText={(v) => set(f.k, v)} placeholder={f.ph} multiline={f.prio === 1} maxLength={600} />
                  ),
                )}
              </Card>
            </View>
          );
        })}

        <PrimaryButton style={{ marginTop: 24 }} label="Uložit nouzové údaje" onPress={save} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

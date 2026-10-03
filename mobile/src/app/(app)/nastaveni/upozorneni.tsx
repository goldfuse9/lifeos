import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';
import { REMIND_KEYS, type RemindKey } from '@/domain/reminders';
import { notificationPermission, scheduledReminders } from '@/platform/notifications';
import { Backdrop, Card, Chip, Divider, Muted, Note, T, ToggleRow, TopBar, useToast } from '@/ui/kit';
import { C } from '@/ui/theme';

/**
 * Upozornění — místní připomínky termínů. Jedno zapnutí, výchozí čas
 * připomenutí a soukromí textu na zamčené obrazovce.
 */
export default function Upozorneni() {
  const s = useSession();
  const toast = useToast();
  const st = s.settings;
  const [busy, setBusy] = useState(false);

  const { value: planned } = useLoad(async () => {
    if (!st.remindersEnabled) return [];
    // Přepočet připomínek běží s malým zpožděním po změně.
    await new Promise((r) => setTimeout(r, 1200));
    return scheduledReminders();
  }, [st.remindersEnabled, st.remindShowTitle]);

  const toggle = async (v: boolean) => {
    if (v) {
      setBusy(true);
      const ok = await notificationPermission(true);
      setBusy(false);
      if (!ok) {
        toast('Upozornění jsou v telefonu vypnutá — povolte je v Nastavení telefonu.');
        return;
      }
    }
    await s.updateSettings({ remindersEnabled: v });
  };

  const def = st.remindDefault as RemindKey[];
  const toggleDef = (k: RemindKey) => s.updateSettings({ remindDefault: def.includes(k) ? def.filter((x) => x !== k) : [...def, k] });

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 }}>
        <TopBar title="Upozornění" backLabel="Zpět do nastavení" />

        <Card style={{ marginTop: 18, overflow: 'hidden', borderRadius: 24 }}>
          <ToggleRow title="Připomínky" sub="Termíny a léky" value={st.remindersEnabled} onChange={toggle} disabled={busy} />
          {st.remindersEnabled ? (
            <>
              <Divider />
              <View style={{ padding: 14, gap: 8 }}>
                <T w="semibold" style={{ fontSize: 13, color: C.muted }}>U nového termínu připomenout</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {REMIND_KEYS.map(([k, l]) => (
                    <Chip key={k} label={l} selected={def.includes(k)} onPress={() => toggleDef(k)} />
                  ))}
                </View>
              </View>
              <Divider />
              <ToggleRow title="Ukázat název termínu a léku" sub={st.remindShowTitle ? 'Např. „Zítra v 9:00 · Kontrola u praktika“' : 'Jen „Zítra v 9:00 · naplánovaný termín“'} value={st.remindShowTitle} onChange={(v) => s.updateSettings({ remindShowTitle: v })} />
            </>
          ) : null}
        </Card>

        {st.remindersEnabled ? (
          <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
            <T w="semibold" style={{ fontSize: 13, color: C.muted }}>Naplánováno</T>
            {planned?.length ? (
              planned.slice(0, 5).map((p, i) => (
                <Muted key={i} style={{ marginTop: 4 }}>
                  {(p.at ? p.at.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' — ' : '') + p.body}
                </Muted>
              ))
            ) : (
              <Muted style={{ marginTop: 4 }}>Zatím nic. Připomenutí nastavíte u termínu v budoucnu.</Muted>
            )}
          </View>
        ) : null}

        <Note style={{ marginTop: 16 }}>
          Připomínky plánuje přímo telefon, nic se neposílá přes internet. Upozornění vidí i zamčený telefon — proto je název termínu ve výchozím stavu skrytý.
        </Note>
      </ScrollView>
    </View>
  );
}

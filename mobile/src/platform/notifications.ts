import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { PlannedReminder } from '@/domain/reminders';

/**
 * Místní upozornění (bez push serveru). Naplánované se vždy celé
 * přepočítají z databáze — žádné ID se nikde nedrží a nic se „nerozjede“.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const CHANNEL = 'terminy';

export async function notificationPermission(ask: boolean): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Připomínky termínů', importance: Notifications.AndroidImportance.HIGH });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!ask || !cur.canAskAgain) return false;
  const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return r.granted;
}

export async function applyReminders(list: PlannedReminder[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const n of list) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { recordId: n.recordId }, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: CHANNEL },
    });
  }
}

export async function clearReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduledReminders(): Promise<{ at: Date | null; body: string }[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all
    .map((n) => {
      const t = n.trigger as { type?: string; value?: number; date?: number | string } | null;
      const raw = t && (t.value ?? t.date);
      return { at: raw != null ? new Date(raw) : null, body: n.content.body ?? '' };
    })
    .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
}

/** Klepnutí na připomínku — otevřít záznam (jednou za každé upozornění). */
export function useReminderTap(open: (recordId: string) => void): void {
  const resp = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!resp) return;
    const key = resp.notification.request.identifier + ':' + resp.notification.date;
    const id = resp.notification.request.content.data?.recordId;
    if (handled.current === key || typeof id !== 'string') return;
    handled.current = key;
    open(id);
  }, [resp, open]);
}

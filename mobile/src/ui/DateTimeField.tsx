import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { LocalDate, LocalTime } from '@/domain/types';
import { combine, longDate, parseLocalDate, toLocalDate, toLocalTime } from '@/domain/dates';
import { C } from './theme';
import { T } from './kit';
import { IconCalendar } from './icons';

/**
 * Výběr data a času. Android: systémový dialog (doporučený imperativní
 * způsob knihovny). iOS: kompaktní kolečko pod tlačítkem.
 */

function Trigger({ label, value, onPress, open }: { label: string; value: string; onPress: () => void; open?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityState={{ expanded: !!open }}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 48, borderRadius: 16, paddingHorizontal: 14, backgroundColor: C.white, borderWidth: 1, borderColor: open ? C.ink : C.line, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.8 : 1 })}
    >
      <T style={{ fontSize: 16, flex: 1 }}>{value}</T>
    </Pressable>
  );
}

export function DateField({ label, value, onChange }: { label: string; value: LocalDate; onChange: (d: LocalDate) => void }) {
  const [open, setOpen] = useState(false);
  const d = parseLocalDate(value);
  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: d, mode: 'date', onValueChange: (_e, x) => x && onChange(toLocalDate(x)) });
    } else setOpen((o) => !o);
  };
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <T w="semibold" style={{ fontSize: 13, color: C.muted }}>{label}</T>
      <Trigger label={label} value={longDate(value) + ' ' + d.getFullYear()} onPress={press} open={open} />
      {open && Platform.OS === 'ios' ? (
        <DateTimePicker value={d} mode="date" display="inline" locale="cs-CZ" accentColor={C.orange} onValueChange={(_e, x) => x && onChange(toLocalDate(x))} />
      ) : null}
    </View>
  );
}

export function TimeField({ label, date, value, onChange }: { label: string; date: LocalDate; value: LocalTime; onChange: (t: LocalTime) => void }) {
  const [open, setOpen] = useState(false);
  const d = combine(date, value);
  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: d, mode: 'time', is24Hour: true, onValueChange: (_e, x) => x && onChange(toLocalTime(x)) });
    } else setOpen((o) => !o);
  };
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <T w="semibold" style={{ fontSize: 13, color: C.muted }}>{label}</T>
      <Trigger label={label} value={value} onPress={press} open={open} />
      {open && Platform.OS === 'ios' ? (
        <DateTimePicker value={d} mode="time" display="spinner" locale="cs-CZ" is24Hour onValueChange={(_e, x) => x && onChange(toLocalTime(x))} />
      ) : null}
    </View>
  );
}

export { IconCalendar };

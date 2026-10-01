import React from 'react';
import { View } from 'react-native';
import { C } from './theme';
import { T } from './kit';

/** Logotyp ve stylu desek („Life“ tučně + „OS“ šedě). */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="HumanCare">
      <T style={{ fontSize: size, lineHeight: size * 1.2, letterSpacing: -size * 0.03 }}>
        <T w="semibold" style={{ fontSize: size }}>Human</T>
        <T style={{ fontSize: size, color: C.muted }}>Care</T>
      </T>
    </View>
  );
}

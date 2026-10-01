import React from 'react';
import { View } from 'react-native';
import { C } from './theme';
import { T } from './kit';

/** Logotyp z desek: „Life“ tučně + „OS“ šedě. */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="LifeOS">
      <T style={{ fontSize: size, lineHeight: size * 1.2, letterSpacing: -size * 0.03 }}>
        <T w="semibold" style={{ fontSize: size }}>Life</T>
        <T style={{ fontSize: size, color: C.muted }}>OS</T>
      </T>
    </View>
  );
}

import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { znackaOf } from '@/domain/skolka';
import { C } from './theme';

/**
 * Značka dítěte ze šatny — stejná kresba jako na tabletu ve školce, aby
 * rodič i dítě poznali „svůj“ obrázek. Bez značky se ukáže prázdný kroužek.
 */
export function Znacka({ value, size = 44 }: { value?: string; size?: number }) {
  const z = znackaOf(value);
  if (!z) {
    return <View style={{ width: size * 0.7, height: size * 0.7, borderRadius: size, borderWidth: 2, borderStyle: 'dashed', borderColor: C.faint }} />;
  }
  return <SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${z.svg}</svg>`} width={size} height={size} />;
}

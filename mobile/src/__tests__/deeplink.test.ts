import { parseLink } from '@/state/deepLink';

// jest.mock se vyzvedne nad import.
jest.mock('react-native', () => ({ Linking: {} }));
jest.mock('expo-router', () => ({ router: {} }));

test('odkazy z widgetu', () => {
  expect(parseLink('lifeos://zapis')).toBe('/zapis');
  expect(parseLink('lifeos://zapis?mood=3')).toBe('/zapis?mood=3');
  expect(parseLink('lifeos:///zaznam/upravit')).toBe('/zaznam/upravit');
  expect(parseLink('lifeos://zapis?mood=9')).toBe('/zapis');
  expect(parseLink('lifeos://nastaveni/zabezpeceni')).toBeNull();
  expect(parseLink('https://evil.example/zapis')).toBeNull();
});

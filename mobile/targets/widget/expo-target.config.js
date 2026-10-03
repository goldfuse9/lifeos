/**
 * iOS widget LifeOS — rychlý zápis do osy (nálada, příznaky, záznam).
 * Widget nečte žádná data (zdravotní údaje zůstávají zašifrované v aplikaci),
 * jen otevírá aplikaci odkazem lifeos://… Proto nepotřebuje App Group a jde
 * podepsat i bezplatným osobním vývojářským týmem.
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: 'widget',
  name: 'LifeOSWidget',
  displayName: 'LifeOS',
  icon: '../../assets/icon.png',
  deploymentTarget: '17.0',
  bundleIdentifier: '.widget',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: {
    $accent: '#17161A',
    $widgetBackground: '#FCFBFA',
  },
};

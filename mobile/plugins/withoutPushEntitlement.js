/**
 * LifeOS používá jen místní připomínky (žádné push ze serveru).
 * expo-notifications jinak přidá do iOS oprávnění „aps-environment“,
 * které osobní (bezplatný) vývojářský tým neumí podepsat.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
};

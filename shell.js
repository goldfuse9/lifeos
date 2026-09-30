/* =============================================================================
   Skořápka — drží desky pohromadě a nic jiného nedělá
   -----------------------------------------------------------------------------
   Desky jsou obrazovky z plátna „Časová osa dne“, spuštěné beze změny.
   Odkazy mezi nimi (`<a href="Prehled.dc.html">`) jsou v nich už nakreslené,
   takže navigace je hotová — skořápka je jen odchytí a přepne desku.

   Přehled je rozcestník: vede z něj na Časovou osu, Nouzovou kartu
   i Dokumenty, a odevšad vede zpátky. Main.dc.html je starší verze osy,
   na kterou nic nevede, a do aplikace nepatří.
   ============================================================================= */

'use strict';

const DESKY = {
  'Prehled.dc.html': 'prehled',
  'Mix.dc.html': 'osa',
  'Nouze.dc.html': 'nouze',
  'Dokumenty.dc.html': 'dokumenty',
};
const PODLE_JMENA = Object.fromEntries(Object.entries(DESKY).map(([s, k]) => [k, s]));
const VYCHOZI = 'prehled';

const koren = document.getElementById('deska');
const nacitam = document.getElementById('nacitam');
const chybaEl = document.getElementById('chyba');

const mezipamet = new Map();

async function zdroj(soubor) {
  if (mezipamet.has(soubor)) return mezipamet.get(soubor);
  const o = await fetch(soubor, { cache: 'no-cache' });
  if (!o.ok) throw new Error(`${soubor}: ${o.status}`);
  const t = await o.text();
  mezipamet.set(soubor, t);
  return t;
}

let prepinam = false;

async function otevri(klic, zHashe) {
  const soubor = PODLE_JMENA[klic];
  if (!soubor || prepinam) return;
  prepinam = true;
  try {
    chybaEl.hidden = true;
    nacitam.hidden = false;
    const t = await zdroj(soubor);
    window.DC.pripojDesku(t, koren, soubor);
    nacitam.hidden = true;
    document.title = klic === 'prehled' ? 'LifeOS' : 'LifeOS — ' + klic;
    if (!zHashe) location.hash = '#' + klic;
    window.scrollTo(0, 0);
  } catch (e) {
    nacitam.hidden = true;
    chybaEl.hidden = false;
    chybaEl.textContent = 'Obrazovku se nepodařilo otevřít.\n\n' + (e && e.stack ? e.stack : e);
  } finally {
    prepinam = false;
  }
}

/* Odkaz na jinou desku přepne obrazovku, nenačte stránku znovu. Odkazy
   uvnitř desky (#kotva) a ven (https://) zůstávají, jak jsou. */
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (!href.endsWith('.dc.html')) return;
  e.preventDefault();
  const klic = DESKY[href.replace(/^\.?\//, '')];
  if (klic) otevri(klic);
});

window.addEventListener('hashchange', () => {
  const klic = (location.hash || '').slice(1);
  if (PODLE_JMENA[klic]) otevri(klic, true);
});

const zacatek = (location.hash || '').slice(1);
otevri(PODLE_JMENA[zacatek] ? zacatek : VYCHOZI, true);

/* Data v telefonu si drží desky samy. Tohle jen řekne prohlížeči, že o ně
   stojíme — Safari maže podle „nejdéle nepoužité“, když dojde místo. */
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

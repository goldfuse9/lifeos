/* =============================================================================
   Service worker — kvůli němu appka běží v letadle.
   -----------------------------------------------------------------------------
   Strategie: „napřed cache“ pro vlastní soubory, síť jen jako záloha.
   U prototypu je to správně — soubory se mění jen tehdy, když je vyměním
   já, a tehdy se zvedne VERZE níž a stará cache se smaže.

   Písmo z Google Fonts je jediná věc zvenčí. Ukládá se při prvním
   načtení; bez sítě a bez něj appka spadne na systémové písmo, což je
   v pořádku — nespadne celá.
   ============================================================================= */

const VERZE = 'lifeos-v1';
const SOUBORY = [
  './',
  './index.html',
  './dc.js',
  './shell.js',
  './Prehled.dc.html',
  './Mix.dc.html',
  './Nouze.dc.html',
  './Dokumenty.dc.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERZE)
      // `reload` obchází HTTP cache prohlížeče, jinak by se do offline
      // kopie mohla uložit stará verze souboru.
      .then((c) => c.addAll(SOUBORY.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((k) => Promise.all(k.filter((n) => n !== VERZE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((zCache) => {
      if (zCache) return zCache;

      return fetch(req)
        .then((odpoved) => {
          // Uloží se jen to, co je naše nebo písmo. Cizí požadavky
          // prototyp nedělá, ale kdyby se někdy přidaly, ať cache
          // neroste o věci, které tam nepatří.
          const u = new URL(req.url);
          const nase = u.origin === location.origin;
          const pismo = u.host.endsWith('googleapis.com') || u.host.endsWith('gstatic.com');
          if (odpoved.ok && (nase || pismo)) {
            const kopie = odpoved.clone();
            caches.open(VERZE).then((c) => c.put(req, kopie));
          }
          return odpoved;
        })
        .catch(() => {
          // Offline a není v cache: u navigace vrátíme appku, ať se
          // místo dinosaura otevře to, co uživatel čeká.
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    }),
  );
});

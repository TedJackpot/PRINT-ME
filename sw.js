/* PRINT ME — service worker : l'application reste utilisable sans Internet.
   L'index est toujours demande au reseau d'abord, puis servi depuis le cache. */
const CACHE = 'printme-v1';
const COQUILLE = ['./', './index.html', './manifest.webmanifest', './vendor/qrcode.min.js', './vendor/icone.svg'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;        /* helper local, polices : reseau direct */

  const page = url.pathname.endsWith('/') || url.pathname.endsWith('index.html') || url.pathname.endsWith('.html');

  e.respondWith(
    fetch(r)
      .then((res) => {
        const copie = res.clone();
        caches.open(CACHE).then((c) => c.put(r, copie)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(r).then((m) => m || (page ? caches.match('./index.html') : Promise.reject(new Error('hors ligne'))))
      )
  );
});

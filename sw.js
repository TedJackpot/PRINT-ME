/* PRINT ME — seules les ressources de cette application sont mises en cache. */
const CACHE = 'printme-v2-studio-2.1.1';
const CORE = ['./assets/fonts.css','./assets/fonts/roboto-latin-400-normal.woff2','./assets/fonts/roboto-latin-400-italic.woff2','./assets/fonts/roboto-latin-700-normal.woff2','./assets/fonts/montserrat-latin-400-normal.woff2','./assets/fonts/montserrat-latin-700-italic.woff2','./assets/fonts/montserrat-latin-700-normal.woff2','./assets/fonts/inter-latin-400-italic.woff2','./assets/fonts/roboto-latin-700-italic.woff2','./assets/fonts/inter-latin-400-normal.woff2','./assets/fonts/inter-latin-700-italic.woff2','./assets/fonts/montserrat-latin-400-italic.woff2','./assets/fonts/inter-latin-700-normal.woff2','./', './manifest.webmanifest', './assets/studio.css', './vendor/qrcode.min.js', './vendor/icone.svg', './vendor/icon-192.png', './vendor/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('printme-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok) event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, response.clone())));
    return response;
  }).catch(async () => (await caches.match(request)) || (request.mode === 'navigate' ? await caches.match('./') : Response.error())));
});

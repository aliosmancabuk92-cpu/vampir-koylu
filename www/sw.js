/* Vampir Köylü — service worker: uygulama kabuğunu önbelleğe alır (çevrimdışı tek oyunculu) */
const VERSION = 'vk-v2';
const SHELL = ['./', './index.html', './solo.js', './supabase.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Supabase (realtime/REST) asla önbelleğe alınmaz
  if (url.hostname.endsWith('supabase.co')) return;
  // Aynı kaynak: önce önbellek, arka planda güncelle (stale-while-revalidate)
  if (url.origin === location.origin) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const cached = await c.match(req);
      const fresh = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
      return cached || (await fresh) || new Response('Çevrimdışı', { status: 503 });
    }));
    return;
  }
  // Google Fonts vb.: önbellek varsa kullan, yoksa ağdan al ve sakla
  e.respondWith(caches.open(VERSION + '-ext').then(async (c) => {
    const cached = await c.match(req);
    if (cached) return cached;
    try { const res = await fetch(req); if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; } catch (err) { return new Response('', { status: 504 }); }
  }));
});

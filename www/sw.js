/* Vampir Köylü — service worker
   Kod (html/js/json): önce ağ (güncel sürüm hemen gelsin), yoksa önbellek.
   Ağır dosyalar (3B model, doku, ses): önce önbellek (çevrimdışı ve hızlı). */
const VERSION = 'vk-v6';
const SHELL = ['./', './index.html', './solo.js', './multi.js', './supabase.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== VERSION + '-ext').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const HEAVY = /\.(glb|jpg|jpeg|png|mp3|ogg|webp)$/i;
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;
  if (url.origin === location.origin) {
    if (HEAVY.test(url.pathname)) {
      e.respondWith(caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req); if (hit) return hit;
        const res = await fetch(req); if (res && res.ok) c.put(req, res.clone()); return res;
      }));
      return;
    }
    e.respondWith(caches.open(VERSION).then(async (c) => {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
        const res = await fetch(req, { signal: ctl.signal }); clearTimeout(t);
        if (res && res.ok) c.put(req, res.clone());
        return res;
      } catch (err) {
        return (await c.match(req)) || (await c.match('./index.html')) || new Response('Çevrimdışı', { status: 503 });
      }
    }));
    return;
  }
  e.respondWith(caches.open(VERSION + '-ext').then(async (c) => {
    const cached = await c.match(req);
    if (cached) return cached;
    try { const res = await fetch(req); if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; } catch (err) { return new Response('', { status: 504 }); }
  }));
});

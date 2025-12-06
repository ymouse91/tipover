/* TipOver SW — yksinkertainen app-shell + assets + pulmatiedosto */
const CACHE = 'tipover-v8';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './tipover_pulmat.json',
  './pwa_icon_180.png',
  './pwa_icon_192.png',
  './pwa_icon_512.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  // cache-first app shell & puzzles
  if(ASSETS.some(p => url.pathname.endsWith(p.replace('./','/')))){
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(resp=>{
        const copy = resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy));
        return resp;
      }))
    );
    return;
  }
  // network-first fallback
  e.respondWith(
    fetch(e.request).catch(()=>caches.match(e.request))
  );
});

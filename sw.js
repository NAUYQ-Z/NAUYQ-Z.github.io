/* 预缓存全部静态资源（卡图也在内），离线可用。 */
const VERSION = 'tarot-v3';
const FILES = [
  "index.html",
  "css/app.css",
  "js/data.js",
  "js/db.js",
  "js/core.js",
  "js/app.js",
  "js/views.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-180.png",
  "icons/maskable-192.png",
  "icons/maskable-512.png",
  "assets/cards/c01.webp",
  "assets/cards/c02.webp",
  "assets/cards/c03.webp",
  "assets/cards/c04.webp",
  "assets/cards/c05.webp",
  "assets/cards/c06.webp",
  "assets/cards/c07.webp",
  "assets/cards/c08.webp",
  "assets/cards/c09.webp",
  "assets/cards/c10.webp",
  "assets/cards/c11.webp",
  "assets/cards/c12.webp",
  "assets/cards/c13.webp",
  "assets/cards/c14.webp",
  "assets/cards/m00.webp",
  "assets/cards/m01.webp",
  "assets/cards/m02.webp",
  "assets/cards/m03.webp",
  "assets/cards/m04.webp",
  "assets/cards/m05.webp",
  "assets/cards/m06.webp",
  "assets/cards/m07.webp",
  "assets/cards/m08.webp",
  "assets/cards/m09.webp",
  "assets/cards/m10.webp",
  "assets/cards/m11.webp",
  "assets/cards/m12.webp",
  "assets/cards/m13.webp",
  "assets/cards/m14.webp",
  "assets/cards/m15.webp",
  "assets/cards/m16.webp",
  "assets/cards/m17.webp",
  "assets/cards/m18.webp",
  "assets/cards/m19.webp",
  "assets/cards/m20.webp",
  "assets/cards/m21.webp",
  "assets/cards/p01.webp",
  "assets/cards/p02.webp",
  "assets/cards/p03.webp",
  "assets/cards/p04.webp",
  "assets/cards/p05.webp",
  "assets/cards/p06.webp",
  "assets/cards/p07.webp",
  "assets/cards/p08.webp",
  "assets/cards/p09.webp",
  "assets/cards/p10.webp",
  "assets/cards/p11.webp",
  "assets/cards/p12.webp",
  "assets/cards/p13.webp",
  "assets/cards/p14.webp",
  "assets/cards/s01.webp",
  "assets/cards/s02.webp",
  "assets/cards/s03.webp",
  "assets/cards/s04.webp",
  "assets/cards/s05.webp",
  "assets/cards/s06.webp",
  "assets/cards/s07.webp",
  "assets/cards/s08.webp",
  "assets/cards/s09.webp",
  "assets/cards/s10.webp",
  "assets/cards/s11.webp",
  "assets/cards/s12.webp",
  "assets/cards/s13.webp",
  "assets/cards/s14.webp",
  "assets/cards/w01.webp",
  "assets/cards/w02.webp",
  "assets/cards/w03.webp",
  "assets/cards/w04.webp",
  "assets/cards/w05.webp",
  "assets/cards/w06.webp",
  "assets/cards/w07.webp",
  "assets/cards/w08.webp",
  "assets/cards/w09.webp",
  "assets/cards/w10.webp",
  "assets/cards/w11.webp",
  "assets/cards/w12.webp",
  "assets/cards/w13.webp",
  "assets/cards/w14.webp"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
    })
  );
});

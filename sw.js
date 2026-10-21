/* Service worker đơn giản: cache các file tĩnh của app để mở nhanh/offline-first
   phần giao diện (dữ liệu tính toán/lưu lịch sử vẫn cần mạng để gọi Supabase). */
const CACHE_NAME = 'vanhanh-shop-v21'; // v21: toi uu dashboard (bang lai theo SP gon, bo zone khu vuc + CTR, 2 the goi ship tach san, KOC top 10, SKU/size 1 dong/mau)
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './calc.js',
  './app.js',
  './init.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Chỉ cache-first cho tài nguyên CÙNG GỐC (app shell) — mọi request tới
  // Supabase hoặc CDN SheetJS luôn đi thẳng ra mạng, không cache.
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

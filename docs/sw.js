'use strict';

// オフライン対応(Service Worker)。
// 一度開いたファイルを覚えておき、次からはネットがなくても開けるようにする。
// 新しいバージョンを公開したら、下の VERSION の数字を上げる(古い記憶が入れ替わる)。
const VERSION = 'v1';
const CACHE = `masudone-${VERSION}`;

// 最初に覚えておくファイル(フォントの細かい分割ファイルは、使われたときに自動で覚える)
const CORE = [
  './', 'index.html', 'style.css', 'app.js', 'celebrate.js', 'store.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'fonts/line-seed-jp-400.css', 'fonts/line-seed-jp-700.css', 'fonts/line-seed-jp-800.css',
  'img/mon-blue.png', 'img/mon-yellow.png', 'img/mon-teal.png',
  'img/mon-red.png', 'img/mon-purple.png', 'img/mon-green.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('masudone-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// まず覚えているものをすぐ返し、裏で最新版を取りに行って次回に備える
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => null);
      if (cached) { network.catch(() => {}); return cached; }
      const res = await network;
      if (res) return res;
      // ネットもなく、覚えてもいないとき:ページ移動なら本体を返す
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    })
  );
});

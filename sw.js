const CACHE='coachchess-v1.3.0';
const ASSETS=[
'./','index.html','app.js','manifest.webmanifest','VERSION',
'assets/icon-192.png','assets/icon-512.png',
'engine/stockfish-18-lite-single.js','engine/stockfish-18-lite-single.wasm'
];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
])));
self.addEventListener('fetch',e=>e.respondWith(
  caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{
    const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;
  }))
));
const CACHE="coachchess-2.0.0";
const CORE=[
  "./?v=2.0.0",
  "index.html?v=2.0.0",
  "app.js?v=2.1.0",
  "manifest.webmanifest?v=2.0.0",
  "icon-192.png",
  "icon-512.png",
  "engine.js?v=2.1.0",
  "stockfish-18-lite-single.wasm?v=2.1.0"
];
self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const isCode=/\.(?:html|js|json|webmanifest)$/.test(url.pathname)||url.pathname.endsWith("/");
  if(isCode){
    event.respondWith(fetch(event.request,{cache:"no-store"}).then(response=>{
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
    }).catch(()=>caches.match(event.request)));
  }else{
    event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
    })));
  }
});

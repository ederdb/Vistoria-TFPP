/* Service worker do TFPP - funcionamento offline.
   Ao publicar uma nova versão do formulário, troque o número em CACHE. */
const CACHE = "tfpp-v1";
const CDN_PDF = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
const ARQUIVOS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (event) {
    event.waitUntil((async function () {
        const cache = await caches.open(CACHE);
        await cache.addAll(ARQUIVOS);
        try { await cache.add(CDN_PDF); } catch (e) { /* tenta de novo no primeiro uso online */ }
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", function (event) {
    event.waitUntil((async function () {
        const nomes = await caches.keys();
        await Promise.all(nomes.filter(function (n) { return n !== CACHE; })
                               .map(function (n) { return caches.delete(n); }));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", function (event) {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);

    // Biblioteca de PDF: cache primeiro
    if (req.url === CDN_PDF) {
        event.respondWith((async function () {
            const cache = await caches.open(CACHE);
            const guardado = await cache.match(CDN_PDF);
            if (guardado) return guardado;
            const resp = await fetch(req);
            if (resp && (resp.ok || resp.type === "opaque")) cache.put(CDN_PDF, resp.clone());
            return resp;
        })());
        return;
    }

    // Arquivos do próprio app: usa o cache e atualiza em segundo plano
    if (url.origin === self.location.origin) {
        event.respondWith((async function () {
            const cache = await caches.open(CACHE);
            const guardado = await cache.match(req, { ignoreSearch: true });
            const rede = fetch(req).then(function (resp) {
                if (resp && resp.ok) cache.put(req, resp.clone());
                return resp;
            }).catch(function () { return null; });

            if (guardado) { event.waitUntil(rede); return guardado; }
            const resp = await rede;
            if (resp) return resp;
            if (req.mode === "navigate") return cache.match("./index.html");
            return Response.error();
        })());
    }
});

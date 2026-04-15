// sw.js - Cache de tiles do mapa por 7 dias
const CACHE_NAME = 'map-tiles-v1';
const EXPIRATION_DAYS = 7;
const EXPIRATION_MS = EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

// URLs dos provedores de tile que queremos cachear
const TILE_PROVIDERS = [
    'basemaps.cartocdn.com',
    'stamen-tiles.a.ssl.fastly.net',
    'tile.openstreetmap.org'
];

// Função para verificar se a requisição é de tile de mapa
function isTileRequest(url) {
    return TILE_PROVIDERS.some(provider => url.includes(provider));
}

// Instalação - abre o cache
self.addEventListener('install', event => {
    console.log('Service Worker instalado');
    self.skipWaiting(); // ativa imediatamente
});

// Ativação - remove caches antigos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Interceptação das requisições
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Só cacheia requisições de tiles
    if (isTileRequest(url)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async cache => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    // Verifica se o cache expirou
                    const cachedDate = cachedResponse.headers.get('sw-cache-date');
                    if (cachedDate && (Date.now() - parseInt(cachedDate)) < EXPIRATION_MS) {
                        return cachedResponse;
                    } else {
                        await cache.delete(event.request);
                    }
                }
                // Busca da rede e armazena
                const networkResponse = await fetch(event.request);
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    const headers = new Headers(responseToCache.headers);
                    headers.set('sw-cache-date', Date.now().toString());
                    const cachedResponse = new Response(responseToCache.body, {
                        status: responseToCache.status,
                        statusText: responseToCache.statusText,
                        headers: headers
                    });
                    await cache.put(event.request, cachedResponse);
                }
                return networkResponse;
            }).catch(() => fetch(event.request))
        );
    } else {
        // Para outras requisições, apenas passa adiante
        event.respondWith(fetch(event.request));
    }
});
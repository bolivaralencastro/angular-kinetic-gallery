// O nome do seu repositório no GitHub Pages
const REPO_NAME = '/angular-kinetic-gallery';
const CACHE_NAME = 'kinetic-gallery-cache-v1';
const PRECACHE_URLS = [
  `${REPO_NAME}/`,
  `${REPO_NAME}/index.html`,
  `${REPO_NAME}/manifest.webmanifest`,
  `${REPO_NAME}/assets/icons/icon-192.svg`,
  `${REPO_NAME}/assets/icons/icon-512.svg`
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Apenas cacheia respostas válidas
        if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Se for uma navegação e falhar, sirva o index.html do cache
        // **AQUI TAMBÉM PRECISA SER CORRIGIDO**
        if (event.request.mode === 'navigate') {
          return caches.match(`${REPO_NAME}/index.html`);
        }

        return Response.error();
      })
  );
});

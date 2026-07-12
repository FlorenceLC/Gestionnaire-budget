/**
 * service-worker.js — PWA Service Worker
 *
 * IMPORTANT : Changer CACHE_VERSION à chaque déploiement force
 * le navigateur à télécharger les nouveaux fichiers immédiatement.
 * Le numéro de version est aussi affiché dans les paramètres.
 */

const CACHE_VERSION = 'v4';  // ← incrémenter à chaque mise à jour
const CACHE_NAME = `monbudget-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './js/data.js',
  './js/gist.js',
  './js/ui.js',
  './js/charts.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Installation : mise en cache des assets
self.addEventListener('install', event => {
  // skipWaiting immédiat : le nouveau SW prend la main sans attendre
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS_TO_CACHE.map(url => cache.add(url).catch(() => null)))
    )
  );
});

// Activation : supprime TOUS les anciens caches et prend le contrôle immédiatement
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Suppression ancien cache :', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())   // prend le contrôle de tous les onglets ouverts
      .then(() => {
        // Notifie tous les onglets qu'une mise à jour est disponible
        self.clients.matchAll().then(clients =>
          clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }))
        );
      })
  );
});

// Fetch : Network-First pour les fichiers de l'app (toujours à jour),
//         Cache-First uniquement pour les CDN externes
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API GitHub → toujours réseau, jamais de cache
  if (url.hostname === 'api.github.com') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Hors ligne' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // CDN externes (fonts, FA, Chart.js) → Cache-First (rarement mis à jour)
  const isExternal = url.hostname !== self.location.hostname;
  if (isExternal) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Fichiers de l'app → Network-First : on va chercher la version fraîche,
  // et on sert le cache uniquement si le réseau échoue (mode offline)
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached =>
        cached || (event.request.destination === 'document'
          ? caches.match('./index.html')
          : null)
      ))
  );
});

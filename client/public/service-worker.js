/* eslint-disable no-restricted-globals */
/**
 * service-worker.js — Service Worker de Gestión Cristiana TMDV
 *
 * Estrategia de caché:
 *   1. Navegación / HTML (request.mode === 'navigate'):
 *      → network-first. Garantiza que index.html siempre llegue fresco
 *      tras un deploy (referencia los nuevos hashes de JS/CSS). Fallback al
 *      caché solo si no hay red.
 *
 *   2. Assets versionados por hash (/static/*):
 *      → cache-first. CRA genera nombres con hash en cada build, así que
 *      cambian de URL al desplegar — nunca se sirve un asset obsoleto.
 *
 *   3. Llamadas a /api/* y métodos no-GET:
 *      → passthrough directo a la red (NO se cachean). Datos de iglesia,
 *      eventos, miembros, etc. siempre frescos desde el backend.
 *
 *   4. Otros recursos (manifest, íconos, fuentes externas):
 *      → stale-while-revalidate (responde rápido del cache y actualiza
 *      en background).
 *
 * Auto-actualización:
 *   - install: skipWaiting() para que el SW nuevo se active sin esperar
 *     que se cierren todas las pestañas.
 *   - activate: clients.claim() para tomar control inmediato + limpieza
 *     de caches viejos.
 *   - message 'SKIP_WAITING': el cliente puede forzar la activación tras
 *     mostrar un toast "Nueva versión disponible".
 */

// Versionado del cache: bump al cambiar la estrategia (no hace falta tocar
// esto en cada deploy — los assets cambian por hash y el HTML va network-first).
const CACHE_VERSION = 'tmdv-v1';
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// =============================================================================
// INSTALL
// =============================================================================
self.addEventListener('install', (event) => {
  // Activar el nuevo SW inmediatamente, sin esperar a que se cierren las
  // pestañas con la versión anterior. La toma efectiva del control la hace
  // el evento 'activate' con clients.claim().
  self.skipWaiting();
  // No precargamos nada en install — el cache se llena al usar la app.
  event.waitUntil(Promise.resolve());
});

// =============================================================================
// ACTIVATE — limpieza de caches viejos
// =============================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Borrar cualquier cache que no pertenezca a la versión actual.
      // Esto evita acumular MB de versiones antiguas en el dispositivo.
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      // Tomar control de los clients abiertos (pestañas) inmediatamente.
      await self.clients.claim();
    })()
  );
});

// =============================================================================
// MESSAGE — el cliente puede pedir SKIP_WAITING para forzar la activación
// =============================================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// =============================================================================
// FETCH — enrutado por estrategia
// =============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1) Solo manejamos GET. Métodos no-GET (POST/PUT/DELETE) van directo a la red.
  if (request.method !== 'GET') return;

  // 2) Llamadas al API → SIEMPRE red, sin tocar el cache.
  //    Cubrimos tanto rutas relativas como absolutas al mismo origen.
  if (url.pathname.startsWith('/api/')) return;

  // 3) Navegación (HTML) → network-first
  //    Esto es lo que garantiza que tras un deploy la app cargue el index.html
  //    nuevo (que referencia los chunks JS con nuevo hash).
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 4) Assets versionados de CRA (/static/*) → cache-first
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 5) Otros (manifest, íconos, fuentes…) → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

// =============================================================================
// Estrategias auxiliares
// =============================================================================

/**
 * network-first: intenta red, cae al cache si falla.
 * Usado para HTML de navegación.
 */
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    // Sólo cacheamos respuestas exitosas para no enmascarar 404/500
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // Sin red: intentar servir la última versión cacheada del HTML
    const cached = await cache.match(request);
    if (cached) return cached;
    // Como último recurso, intentar la raíz "/" (SPA shell)
    const root = await cache.match('/');
    if (root) return root;
    throw err;
  }
}

/**
 * cache-first: si está en cache lo sirve y nunca pega a la red.
 * Usado para assets con hash que cambian de URL en cada build.
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // Sin red y sin cache: dejar que falle el fetch original
    throw err;
  }
}

/**
 * stale-while-revalidate: responde con cache (si hay) y refresca en background.
 * Bueno para íconos, manifest, fuentes — recursos donde "ligeramente viejo"
 * está OK pero queremos refrescar pronto.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  // Si hay cache, devolverlo de inmediato; si no, esperar a la red.
  return cached || (await networkPromise) || fetch(request);
}

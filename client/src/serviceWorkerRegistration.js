/**
 * serviceWorkerRegistration.js
 *
 * Helper para registrar el service worker `/service-worker.js`.
 *
 * Por qué este helper:
 *   - Encapsula la detección de actualizaciones (evento `updatefound`).
 *   - Llama al callback `onUpdate(registration)` cuando hay una versión nueva
 *     en estado `installed` Y ya hay un controller activo (= usuario tiene
 *     una versión vieja en pantalla → debe ofrecérsele recargar).
 *   - Llama a `onSuccess(registration)` la primera vez que se instala.
 *
 * Buenas prácticas:
 *   - Solo se registra en producción para no enredar el dev-server.
 *   - Verifica que el SW exista (404 → desregistra cualquier SW residual).
 *   - Maneja errores con console.error sin romper la app.
 */

// En CRA, PUBLIC_URL apunta al origin público del build. Si la app se sirve
// desde un subpath (raro en este proyecto), garantizamos el mismo origen.
const isLocalhost = Boolean(
  typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      // [::1] = localhost IPv6
      window.location.hostname === '[::1]' ||
      // 127.0.0.0/8 = localhost IPv4
      /^127(?:\.\d{1,3}){3}$/.test(window.location.hostname))
);

export function register(config) {
  // Solo en producción y solo si el navegador lo soporta
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
    return;
  }

  // Si la app se sirve desde un origen distinto al del SW, abortar.
  // (publicUrl viene del PUBLIC_URL de CRA — normalmente vacío = mismo origen.)
  const publicUrl = new URL(process.env.PUBLIC_URL || '', window.location.href);
  if (publicUrl.origin !== window.location.origin) return;

  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL || ''}/service-worker.js`;

    if (isLocalhost) {
      // En localhost, primero verificar que el archivo del SW realmente exista.
      // Si no, desregistrar cualquier SW viejo para evitar caches huérfanos.
      checkValidServiceWorker(swUrl, config);
    } else {
      registerValidSW(swUrl, config);
    }
  });
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      // Cuando se detecta una nueva versión del SW
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Hay un SW viejo controlando la página → existe una versión
              // anterior cargada en el navegador. Avisar al usuario.
              if (config && typeof config.onUpdate === 'function') {
                config.onUpdate(registration);
              }
            } else {
              // Primera instalación (no había SW antes). Todo en cache para uso offline.
              if (config && typeof config.onSuccess === 'function') {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('Error registrando service worker:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  // Busca el SW; si no existe (o el content-type no es JS), desregistra y recarga.
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      // Sin internet en localhost — no es un error real para el flujo de PWA.
      console.log('App ejecutándose en modo offline (sin conexión).');
    });
}

/**
 * Desregistra el SW activo. Útil para diagnósticos manuales.
 */
export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => {
        console.error('Error desregistrando service worker:', error.message);
      });
  }
}

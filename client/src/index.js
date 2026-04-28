import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import theme from './theme';
import App from './App';
import { AuthProvider } from './context/AuthContext';
// Helper para registrar el service worker y detectar actualizaciones
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {/* CssBaseline normaliza estilos base del navegador */}
        <CssBaseline />
        <AuthProvider>
          <App />
          <ToastContainer position="top-right" autoClose={3000} />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// =============================================================================
// PWA: Registro del service worker con auto-actualización
// =============================================================================
// - onUpdate: se dispara cuando hay un SW NUEVO esperando (post-deploy).
//   Mostramos un toast persistente con un botón "Actualizar" que:
//     1. Envía 'SKIP_WAITING' al SW pendiente para que se active de inmediato.
//     2. Al activarse, dispara 'controllerchange' → recargamos la página
//        para que cargue los chunks nuevos.
// - onSuccess: primera instalación. No mostramos UI (transparente al usuario).
// - Si el navegador no soporta SW o estamos en dev, el helper hace short-circuit.
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    // Función que aplica la actualización cuando el usuario hace click
    const applyUpdate = () => {
      const waiting = registration.waiting;
      if (!waiting) {
        // Caso extremo: el SW ya pasó de 'waiting' antes del click → reload directo
        window.location.reload();
        return;
      }
      // Pedirle al SW pendiente que se active inmediatamente
      waiting.postMessage({ type: 'SKIP_WAITING' });
    };

    // Cuando el SW nuevo toma control, recargar la página automáticamente.
    // Usamos un flag para evitar el bucle infinito que documenta MDN.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // Toast persistente (autoClose: false) con botón de acción.
    // El usuario decide cuándo recargar — si rechaza, el SW nuevo se activará
    // automáticamente la próxima vez que cierre y abra todas las pestañas.
    toast.info(
      ({ closeToast }) => (
        <div>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            Hay una nueva versión disponible
          </div>
          <button
            type="button"
            onClick={() => {
              applyUpdate();
              closeToast();
            }}
            style={{
              background: '#1565C0',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Actualizar ahora
          </button>
        </div>
      ),
      {
        autoClose: false,        // No se cierra solo: la actualización es importante
        closeOnClick: false,     // Que el usuario pulse el botón explícitamente
        draggable: false,
        position: 'top-center',
      }
    );
  },
  onSuccess: () => {
    // Primera instalación — la app ya cachea sus assets para próximas visitas.
    // No molestamos al usuario con un toast aquí.
    console.log('Service worker registrado: app lista para uso offline.');
  },
});

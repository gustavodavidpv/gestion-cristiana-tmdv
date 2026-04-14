/**
 * index.js - Servidor principal Express
 * 
 * En PRODUCCIÓN:
 *   - Sirve los archivos estáticos del build de React
 *   - Cualquier ruta no-API devuelve index.html (SPA routing)
 *   - Puerto definido por variable de entorno PORT (Render lo asigna)
 * 
 * En DESARROLLO:
 *   - Solo sirve la API en puerto 5000
 *   - React se ejecuta aparte en puerto 3000 con proxy
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./config/database');
const routes = require('./routes');
const { ensureSystemRoles, ensureDefaultRolePermissions } = require('./utils/roleSetup');

const app = express();
const PORT = process.env.PORT || 5000;

// =============================================
// MIDDLEWARE
// =============================================

// CORS: En producción no se necesita porque frontend y backend están en el mismo origen
const corsOrigin = process.env.NODE_ENV === 'production'
  ? false // Mismo servidor, no necesita CORS
  : (process.env.CLIENT_URL || 'http://localhost:3000');

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos: solo logos (público, necesario para login)
// Los archivos de actas se sirven via API autenticada (GET /api/minutes/:id/files/:fileId/download)
app.use('/uploads/logos', express.static(path.join(
  process.env.UPLOAD_PATH || path.join(__dirname, 'public', 'uploads'),
  'logos'
)));

// =============================================
// RUTAS API
// =============================================
app.use('/api', routes);

// Ruta de salud (útil para health checks de Render)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'Gestión Cristiana - TMDV',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// =============================================
// PRODUCCIÓN: Servir React build
// =============================================
// En producción, el build de React está en ../client/build
// El servidor Express sirve estos archivos estáticos
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
  
  // Servir archivos estáticos del build
  app.use(express.static(clientBuildPath));
  
  // Cualquier ruta que NO sea /api/* devuelve index.html
  // Esto permite que React Router maneje las rutas del frontend
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// =============================================
// MANEJO DE ERRORES
// =============================================
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Error interno del servidor.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Ruta no encontrada (solo en desarrollo, en prod React maneja las rutas)
if (process.env.NODE_ENV !== 'production') {
  app.use('*', (req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada.' });
  });
}

// =============================================
// INICIAR SERVIDOR
// =============================================
const start = async () => {
  await testConnection();

  // Verificar que los modelos se cargan correctamente
  // NOTA: No usamos sync() aquí porque los índices UNIQUE pueden
  // fallar si hay datos duplicados. Usar `npm run db:migrate` para
  // crear/actualizar tablas e índices de forma segura.
  const { sequelize } = require('./models');
  try {
    await sequelize.authenticate();
    console.log('📋 Conexión a la base de datos verificada.');

    try {
      await ensureSystemRoles();
      await ensureDefaultRolePermissions();
      console.log('🔐 Roles del sistema y permisos por defecto verificados.');
    } catch (roleSetupError) {
      console.warn('⚠️  Aviso al verificar roles del sistema:', roleSetupError.message);
    }

    // Iniciar scheduler de notificaciones WhatsApp (cron jobs)
    const { startNotificationScheduler } = require('./utils/notificationScheduler');
    startNotificationScheduler();
  } catch (dbError) {
    console.error('❌ Error al verificar BD:', dbError.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`
    ⛪ ==========================================
       Gestión Cristiana - TMDV
       Servidor corriendo en puerto ${PORT}
       Modo: ${process.env.NODE_ENV || 'development'}
       API: http://localhost:${PORT}/api
    ⛪ ==========================================
    `);
  });
};

start();

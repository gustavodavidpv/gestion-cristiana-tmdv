require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./config/database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// =============================================
// RUTAS
// =============================================
app.use('/api', routes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'Gestión Cristiana - TMDV',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// =============================================
// FRONTEND (React build) en producción
// =============================================
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'build');

  // Servir archivos estáticos del build
  app.use(express.static(clientBuildPath));

  // SPA fallback: cualquier ruta que NO sea /api debe devolver index.html
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

// Ruta no encontrada (solo si NO es producción)
// En producción ya responde el React fallback de arriba.
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

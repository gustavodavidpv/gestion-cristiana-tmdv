/**
 * database.js - Configuración de conexión a PostgreSQL
 * 
 * MODOS DE CONEXIÓN:
 * 1. DATABASE_URL (producción): URL completa que provee Render/Heroku/Railway
 *    Ejemplo: postgresql://user:pass@host:5432/dbname
 * 2. Variables individuales (desarrollo local):
 *    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */
const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

if (process.env.DATABASE_URL) {
  // =========================================
  // MODO PRODUCCIÓN: Usar DATABASE_URL
  // =========================================
  // Render.com y otros servicios proveen esta URL completa.
  // dialectOptions.ssl es REQUERIDO para conexiones externas en Render.
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false, // Sin logs SQL en producción
    pool: {
      max: 5,      // Render free tier tiene límites de conexión
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Necesario para certificados auto-firmados de Render
      },
    },
  });
} else {
  // =========================================
  // MODO DESARROLLO: Variables individuales
  // =========================================
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      define: {
        timestamps: true,
        underscored: true,
      },
    }
  );
}

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a PostgreSQL establecida correctamente.');
    console.log(`   Modo: ${process.env.DATABASE_URL ? 'DATABASE_URL (producción)' : 'Variables locales (desarrollo)'}`);
  } catch (error) {
    console.error('❌ No se pudo conectar a la base de datos:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, testConnection };

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

const isProd = process.env.NODE_ENV === 'production';

const baseOptions = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  define: { timestamps: true, underscored: true },
  ...(isProd
    ? {
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      }
    : {}),
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, baseOptions)
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        ...baseOptions,
      }
    );

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a PostgreSQL establecida correctamente.');
  } catch (error) {
    console.error('❌ Error en migraciones:', error);
    console.error(error?.stack);
    process.exit(1);
  }
};

module.exports = { sequelize, testConnection };

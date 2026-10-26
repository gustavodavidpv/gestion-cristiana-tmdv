/**
 * database.js - Configuración de conexión a la base de datos
 *
 * DB_DIALECT elige el motor (por defecto, o si está vacía: mssql):
 *   - mssql    → SQL Server (Somee u otro), tablas en el schema DB_SCHEMA (por defecto "tmv")
 *   - postgres → PostgreSQL (Render)
 *
 * POSTGRES - MODOS DE CONEXIÓN:
 * 1. DATABASE_URL (producción): URL completa que provee Render/Heroku/Railway
 *    Ejemplo: postgresql://user:pass@host:5432/dbname
 * 2. Variables individuales (desarrollo local):
 *    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 *
 * SQL SERVER - MODOS DE CONEXIÓN (DATABASE_URL se ignora):
 * 1. MSSQL_CONNECTION_STRING: cadena estilo ADO.NET tal como la entrega Somee
 *    Ejemplo: workstation id=x.mssql.somee.com;user id=u;pwd=p;data source=x.mssql.somee.com;initial catalog=x
 * 2. Variables individuales: DB_HOST, DB_PORT (1433), DB_NAME, DB_USER, DB_PASSWORD
 *    Opcionales: DB_ENCRYPT (true), DB_TRUST_SERVER_CERTIFICATE (true)
 */
const { Sequelize, DataTypes, Op } = require('sequelize');
require('dotenv').config();

// SQL Server es el motor por defecto (variable vacía o sin definir).
// Postgres solo se usa si se pide explícitamente con DB_DIALECT=postgres.
const DIALECT = ['postgres', 'postgresql', 'pg'].includes((process.env.DB_DIALECT || '').trim().toLowerCase()) ? 'postgres' : 'mssql';
const isMssql = DIALECT === 'mssql';

/**
 * Schema de las tablas. En SQL Server se califica siempre (el usuario de
 * Somee es dueño de la BD y su schema por defecto queda fijo en "dbo").
 * En Postgres se mantiene "public" salvo que se defina DB_SCHEMA.
 */
const DB_SCHEMA = process.env.DB_SCHEMA || (isMssql ? 'tmv' : null);

/**
 * Lee una cadena de conexión estilo ADO.NET ("clave=valor;clave=valor").
 * "data source" puede traer el puerto como "host,1433".
 */
const parseMssqlConnectionString = (connectionString) => {
  const values = {};
  for (const part of connectionString.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) values[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  const [host, port] = (values['data source'] || values.server || '').replace(/^tcp:/i, '').split(',');
  return {
    host,
    port: port || undefined,
    database: values['initial catalog'] || values.database,
    user: values['user id'] || values.uid || values.user,
    password: values.pwd || values.password,
  };
};

let sequelize;

if (isMssql) {
  // =========================================
  // SQL SERVER
  // =========================================
  const conn = process.env.MSSQL_CONNECTION_STRING
    ? parseMssqlConnectionString(process.env.MSSQL_CONNECTION_STRING)
    : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

  // tedious entrega las columnas DATE como medianoche UTC y Sequelize las
  // formatea en la zona local del servidor (en UTC-5 saldrían un día antes).
  DataTypes.mssql.DATEONLY.parse = (value) => (
    value instanceof Date ? value.toISOString().slice(0, 10) : value
  );

  sequelize = new Sequelize(conn.database, conn.user, conn.password, {
    host: conn.host || 'localhost',
    port: Number(conn.port) || 1433,
    dialect: 'mssql',
    /**
     * Zona horaria America/Panama (UTC-5, sin horario de verano).
     * Las fechas se guardan como DATETIMEOFFSET con offset -05:00.
     */
    timezone: '-05:00',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
      schema: DB_SCHEMA,
    },
    dialectOptions: {
      options: {
        encrypt: process.env.DB_ENCRYPT !== 'false',
        // Somee usa certificado auto-firmado
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
      },
    },
  });
} else if (process.env.DATABASE_URL) {
  // =========================================
  // POSTGRES - MODO PRODUCCIÓN: Usar DATABASE_URL
  // =========================================
  // Render.com y otros servicios proveen esta URL completa.
  // dialectOptions.ssl es REQUERIDO para conexiones externas en Render.
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false, // Sin logs SQL en producción
    /**
     * Zona horaria America/Panama (UTC-5, sin horario de verano).
     * Sequelize interpreta datetimes naivos como UTC-5 al guardar,
     * y retorna timestamps con offset -05:00 al leer.
     */
    timezone: '-05:00',
    pool: {
      max: 5,      // Render free tier tiene límites de conexión
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
      ...(DB_SCHEMA && { schema: DB_SCHEMA }),
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
  // POSTGRES - MODO DESARROLLO: Variables individuales
  // =========================================
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      /**
       * Zona horaria America/Panama (UTC-5, sin horario de verano).
       * Interpreta datetimes naivos como UTC-5 y retorna con offset -05:00.
       */
      timezone: '-05:00',
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
        ...(DB_SCHEMA && { schema: DB_SCHEMA }),
      },
    }
  );
}

/**
 * Nombre de tabla citado y calificado con el schema, para SQL crudo.
 * Ej: qt('members') → [tmv].[members] en SQL Server, "members" en Postgres.
 */
const qt = (tableName) => sequelize.getQueryInterface().queryGenerator.quoteTable(
  DB_SCHEMA ? { tableName, schema: DB_SCHEMA } : tableName
);

/**
 * Búsqueda sin distinguir mayúsculas: Postgres necesita ILIKE; en SQL Server
 * LIKE ya es insensible a mayúsculas con la intercalación por defecto (CI).
 */
const iLike = isMssql ? Op.like : Op.iLike;

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Conexión a ${isMssql ? 'SQL Server' : 'PostgreSQL'} establecida correctamente.`);
    if (isMssql) {
      console.log(`   Servidor: ${sequelize.config.host}/${sequelize.config.database} (schema ${DB_SCHEMA})`);
    } else {
      console.log(`   Modo: ${process.env.DATABASE_URL ? 'DATABASE_URL (producción)' : 'Variables locales (desarrollo)'}`);
    }
  } catch (error) {
    console.error('❌ No se pudo conectar a la base de datos:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, testConnection, isMssql, DB_SCHEMA, qt, iLike };

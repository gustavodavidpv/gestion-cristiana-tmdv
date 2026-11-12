/**
 * schemaUpgrades.js - Columnas nuevas en tablas que ya existen
 *
 * Las migraciones usan sequelize.sync() PLANO (sin alter), que solo crea
 * tablas nuevas. Cuando un modelo existente gana una columna, se agrega aquí
 * y se llama desde migrations/run.js (Postgres) y run-mssql.js (SQL Server)
 * DESPUÉS del sync. Es idempotente: si la columna ya existe no hace nada.
 *
 * No se pasa `comment` al definir columnas: en SQL Server Sequelize escribe
 * el comentario siempre en el schema "dbo" y la sentencia falla en "tmv".
 */
const { DataTypes } = require('sequelize');
const { sequelize, DB_SCHEMA } = require('../config/database');

const tableRef = (tableName) => (DB_SCHEMA ? { tableName, schema: DB_SCHEMA } : tableName);

/**
 * Agrega una columna si todavía no existe.
 * @returns {Promise<boolean>} true si se agregó
 */
const ensureColumn = async (tableName, column, definition) => {
  const qi = sequelize.getQueryInterface();
  const columns = await qi.describeTable(tableRef(tableName));
  if (columns[column]) return false;
  await qi.addColumn(tableRef(tableName), column, definition);
  return true;
};

/** Lista de columnas agregadas después de crear cada tabla */
const COLUMN_UPGRADES = [
  // Tiendita del Club Bíblico: el canje recuerda qué artículo del catálogo se entregó
  ['bible_club_transactions', 'item_id', { type: DataTypes.INTEGER, allowNull: true }],
];

const runSchemaUpgrades = async () => {
  for (const [table, column, definition] of COLUMN_UPGRADES) {
    try {
      if (await ensureColumn(table, column, definition)) {
        console.log(`   ✅ Columna ${table}.${column} agregada.`);
      }
    } catch (e) {
      console.warn(`   ⚠️  ${table}.${column}:`, e.message);
    }
  }
};

module.exports = { runSchemaUpgrades, ensureColumn };

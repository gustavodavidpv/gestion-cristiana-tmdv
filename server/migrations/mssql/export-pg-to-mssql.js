/**
 * export-pg-to-mssql.js - Genera un script T-SQL con TODA la base PostgreSQL
 *
 * Lee el esquema REAL de PostgreSQL (tablas, columnas, PK, UNIQUE, índices,
 * FK y secuencias) y todos los datos, y escribe un único archivo .sql para
 * SQL Server que:
 *   1. Crea el schema destino (por defecto "tmv") y las tablas
 *   2. Inserta TODAS las filas conservando los mismos IDs (IDENTITY_INSERT)
 *   3. Crea índices UNIQUE/normales y las FK (validando integridad)
 *   4. Emula los ON DELETE CASCADE / SET NULL con triggers INSTEAD OF DELETE
 *      (SQL Server rechaza múltiples rutas de cascada, Postgres no)
 *   5. Verifica el conteo de filas de cada tabla
 *
 * Los IDs nuevos continúan donde iba Postgres: cada IDENTITY arranca en el
 * siguiente valor de su secuencia (no se usa DBCC CHECKIDENT RESEED porque
 * tras IDENTITY_INSERT en una tabla nueva entrega el mismo valor, no el siguiente).
 *
 * Todo corre en UNA transacción: si algo falla no queda nada a medias.
 * Si el schema ya tiene alguna de las tablas, el script se detiene sin tocar nada.
 *
 * USO:
 *   node migrations/mssql/export-pg-to-mssql.js [--schema tmv] [--out ruta.sql]
 *
 * La conexión de origen se lee de PG_SOURCE_URL (variable de entorno o
 * archivo server/.env.migration, que está en .gitignore).
 *
 * El archivo generado contiene datos personales: queda en /backups (ignorado por Git).
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.migration') });

// Panamá: UTC-5 fijo, sin horario de verano (misma zona que config/database.js)
const TZ_NAME = 'America/Panama';
const TZ_OFFSET = '-05:00';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SCHEMA = argValue('--schema', process.env.DB_SCHEMA || 'tmv');
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
const OUT = path.resolve(argValue('--out', path.join(__dirname, '..', '..', '..', 'backups', `mssql_${SCHEMA}_${timestamp}.sql`)));

const q = (name) => `[${name.replace(/]/g, ']]')}]`;
const qt = (table) => `${q(SCHEMA)}.${q(table)}`;
const nstr = (value) => `N'${String(value).replace(/'/g, "''")}'`;

// =============================================
// LECTURA DEL ESQUEMA POSTGRES
// =============================================
async function readSchema(pg) {
  const { rows: tables } = await pg.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`);

  const { rows: columns } = await pg.query(`
    SELECT table_name, column_name, data_type, character_maximum_length,
           numeric_precision, numeric_scale, is_nullable, column_default, ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position`);

  // Índices (incluye los que respaldan PK y UNIQUE constraints)
  const { rows: indexes } = await pg.query(`
    SELECT t.relname AS table_name, i.relname AS index_name,
           ix.indisunique AS is_unique, ix.indisprimary AS is_primary,
           ix.indexprs IS NOT NULL OR ix.indpred IS NOT NULL AS is_special,
           array_agg(a.attname::text ORDER BY k.ord) AS columns
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE n.nspname = 'public'
    GROUP BY t.relname, i.relname, ix.indisunique, ix.indisprimary, ix.indexprs, ix.indpred
    ORDER BY t.relname, i.relname`);

  const { rows: fks } = await pg.query(`
    SELECT c.conname AS name, t.relname AS table_name, rt.relname AS ref_table,
           c.confdeltype AS on_delete,
           array_agg(a.attname::text ORDER BY k.ord) AS columns,
           array_agg(ra.attname::text ORDER BY k.ord) AS ref_columns
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_class rt ON rt.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY AS k(attnum, refattnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    JOIN pg_attribute ra ON ra.attrelid = rt.oid AND ra.attnum = k.refattnum
    WHERE c.contype = 'f' AND n.nspname = 'public'
    GROUP BY c.conname, t.relname, rt.relname, c.confdeltype
    ORDER BY t.relname, c.conname`);

  const { rows: checks } = await pg.query(`
    SELECT conrelid::regclass::text AS table_name, conname
    FROM pg_constraint
    WHERE contype IN ('c', 'x') AND connamespace = 'public'::regnamespace`);
  if (checks.length) {
    throw new Error(`Hay CHECK/EXCLUDE constraints no soportados por el generador: ${checks.map((c) => `${c.table_name}.${c.conname}`).join(', ')}`);
  }

  const schema = {};
  for (const { table_name } of tables) {
    schema[table_name] = { name: table_name, columns: [], pk: null, indexes: [], fks: [], identity: null };
  }
  for (const col of columns) schema[col.table_name]?.columns.push(col);

  for (const ix of indexes) {
    const table = schema[ix.table_name];
    if (!table) continue;
    if (ix.is_special) throw new Error(`Índice parcial/expresión no soportado: ${ix.index_name}`);
    if (ix.is_primary) table.pk = ix.columns;
    else table.indexes.push({ name: ix.index_name, unique: ix.is_unique, columns: ix.columns });
  }

  for (const fk of fks) schema[fk.table_name]?.fks.push(fk);

  // Secuencias de columnas serial/identity → IDENTITY en SQL Server
  for (const table of Object.values(schema)) {
    for (const col of table.columns) {
      const { rows: [seq] } = await pg.query(
        'SELECT pg_get_serial_sequence($1, $2) AS seq', [`public.${table.name}`, col.column_name]
      );
      if (!seq.seq) continue;
      const { rows: [state] } = await pg.query(`SELECT last_value, is_called FROM ${seq.seq}`);
      const { rows: [max] } = await pg.query(`SELECT COALESCE(MAX("${col.column_name}"), 0) AS max_id FROM public."${table.name}"`);
      // Último ID entregado por la secuencia (0 si nunca se usó)
      const lastValue = state.is_called ? Number(state.last_value) : Number(state.last_value) - 1;
      table.identity = {
        column: col.column_name,
        // El próximo ID en SQL Server será exactamente el que daría Postgres
        nextValue: Math.max(lastValue, Number(max.max_id)) + 1,
      };
    }
    if (!table.pk) throw new Error(`La tabla ${table.name} no tiene PRIMARY KEY`);
  }

  dedupe(schema);
  return schema;
}

/**
 * sync({ alter: true }) de Sequelize dejó en Postgres cientos de UNIQUE
 * duplicados (roles_name_key1, key2...). En SQL Server se crea uno solo por
 * combinación de columnas; se prefiere el nombre más corto sin sufijo
 * numérico, que coincide con el que Sequelize espera al hacer sync().
 */
function dedupe(schema) {
  const pickName = (names) => {
    const clean = names.filter((n) => !/_key\d+$/.test(n) && !/_fkey\d+$/.test(n));
    return (clean.length ? clean : names).sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  };

  for (const table of Object.values(schema)) {
    const byIndex = new Map();
    for (const ix of table.indexes) {
      const key = `${ix.unique}|${ix.columns.join(',')}`;
      if (!byIndex.has(key)) byIndex.set(key, []);
      byIndex.get(key).push(ix);
    }
    table.indexes = [...byIndex.values()].map((group) => ({
      ...group[0],
      name: pickName(group.map((ix) => ix.name)),
    }));

    const byFk = new Map();
    for (const fk of table.fks) {
      const key = `${fk.columns.join(',')}>${fk.ref_table}(${fk.ref_columns.join(',')})`;
      if (!byFk.has(key)) byFk.set(key, []);
      byFk.get(key).push(fk);
    }
    table.fks = [...byFk.values()].map((group) => {
      const actions = new Set(group.map((fk) => fk.on_delete));
      if (actions.size > 1) throw new Error(`FKs duplicadas con acciones distintas en ${table.name}: ${group.map((g) => g.name)}`);
      return { ...group[0], name: pickName(group.map((fk) => fk.name)) };
    });
  }
}

// =============================================
// MAPEO DE TIPOS
// =============================================
function mssqlType(col) {
  const len = col.character_maximum_length;
  switch (col.data_type) {
    case 'integer': return 'INT';
    case 'smallint': return 'SMALLINT';
    case 'bigint': return 'BIGINT';
    case 'numeric': return col.numeric_precision ? `DECIMAL(${col.numeric_precision}, ${col.numeric_scale || 0})` : 'DECIMAL(38, 10)';
    case 'real': return 'REAL';
    case 'double precision': return 'FLOAT';
    case 'boolean': return 'BIT';
    case 'character varying': return len && len <= 4000 ? `NVARCHAR(${len})` : 'NVARCHAR(MAX)';
    case 'character': return `NCHAR(${len || 1})`;
    case 'text':
    case 'json':
    case 'jsonb': return 'NVARCHAR(MAX)';
    case 'date': return 'DATE';
    case 'timestamp with time zone': return 'DATETIMEOFFSET(7)';
    case 'timestamp without time zone': return 'DATETIME2(7)';
    case 'time without time zone': return 'TIME(7)';
    case 'uuid': return 'UNIQUEIDENTIFIER';
    default: throw new Error(`Tipo no soportado: ${col.table_name}.${col.column_name} (${col.data_type})`);
  }
}

function mssqlDefault(col) {
  const def = col.column_default;
  if (def == null || def.startsWith('nextval(')) return null;
  if (/^NULL(::.*)?$/i.test(def)) return null;
  if (def === 'true') return '1';
  if (def === 'false') return '0';
  if (/^-?\d+(\.\d+)?$/.test(def)) return def;
  if (/^\(?-?\d+(\.\d+)?\)?::(integer|numeric|bigint|smallint)$/.test(def)) return def.replace(/[()]/g, '').split('::')[0];
  const str = def.match(/^'((?:[^']|'')*)'::[a-z ]+$/i);
  if (str) return nstr(str[1].replace(/''/g, "'"));
  if (/^(now\(\)|CURRENT_TIMESTAMP)$/i.test(def)) return 'SYSDATETIMEOFFSET()';
  throw new Error(`DEFAULT no soportado: ${col.table_name}.${col.column_name} = ${def}`);
}

// Expresión SELECT en Postgres que devuelve cada valor como texto ya normalizado
function pgSelectExpr(col) {
  const c = `"${col.column_name}"`;
  switch (col.data_type) {
    case 'timestamp with time zone':
      return `to_char(${c} AT TIME ZONE '${TZ_NAME}', 'YYYY-MM-DD"T"HH24:MI:SS.US')`;
    case 'timestamp without time zone':
      return `to_char(${c}, 'YYYY-MM-DD"T"HH24:MI:SS.US')`;
    case 'date':
      return `to_char(${c}, 'YYYY-MM-DD')`;
    default:
      return `${c}::text`;
  }
}

function mssqlLiteral(col, value) {
  if (value === null) return 'NULL';
  switch (col.data_type) {
    case 'integer':
    case 'smallint':
    case 'bigint':
    case 'numeric':
    case 'real':
    case 'double precision':
      if (!/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value)) throw new Error(`Número inválido en ${col.table_name}.${col.column_name}: ${value}`);
      return value;
    case 'boolean':
      return value === 'true' ? '1' : '0';
    case 'timestamp with time zone':
      return `'${value}${TZ_OFFSET}'`;
    case 'timestamp without time zone':
    case 'date':
    case 'time without time zone':
      return `'${value}'`;
    default:
      return nstr(value);
  }
}

// =============================================
// GENERACIÓN DEL SCRIPT
// =============================================
async function main() {
  const url = process.env.PG_SOURCE_URL;
  if (!url) throw new Error('Falta PG_SOURCE_URL (variable de entorno o server/.env.migration)');

  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pg = new Client({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
  await pg.connect();

  // Lectura consistente: todas las tablas ven la misma foto de los datos
  await pg.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const schema = await readSchema(pg);
  const tables = Object.values(schema);

  const out = [];
  const emit = (line = '') => out.push(line);
  const counts = {};

  emit('-- =====================================================================');
  emit(`-- Migración PostgreSQL → SQL Server (schema [${SCHEMA}])`);
  emit(`-- Generado: ${new Date().toISOString()} por migrations/mssql/export-pg-to-mssql.js`);
  emit('--');
  emit('-- Corre TODO en una sola transacción: si algo falla, no queda nada creado.');
  emit('-- Si alguna tabla ya existe en el schema, se detiene sin modificar nada.');
  emit('--');
  emit('-- Ejecutar con SSMS / Azure Data Studio, o con sqlcmd:');
  emit('--   sqlcmd -S <servidor> -U <usuario> -P <password> -d <base> -f 65001 -x -i <este_archivo>.sql');
  emit('--   (-x desactiva las variables $(...) de sqlcmd para no alterar los datos)');
  emit('-- =====================================================================');
  emit('SET NOCOUNT ON;');
  emit('SET XACT_ABORT ON;');
  emit('');
  emit(`IF SCHEMA_ID(N'${SCHEMA}') IS NOT NULL AND EXISTS (`);
  emit(`  SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID(N'${SCHEMA}')`);
  emit(`    AND name IN (${tables.map((t) => nstr(t.name)).join(', ')})`);
  emit(')');
  emit('BEGIN');
  emit(`  RAISERROR(N'El schema [${SCHEMA}] ya tiene tablas de la aplicación. No se modificó nada.', 16, 1);`);
  emit('  RETURN;');
  emit('END');
  emit('');
  emit('BEGIN TRY');
  emit('BEGIN TRANSACTION;');
  emit('');
  emit(`IF SCHEMA_ID(N'${SCHEMA}') IS NULL EXEC(N'CREATE SCHEMA ${q(SCHEMA)}');`);
  emit('');

  // ---------- 1. Tablas ----------
  emit('-- ---------------------------------------------------------------------');
  emit('-- 1. TABLAS');
  emit('-- ---------------------------------------------------------------------');
  for (const table of tables) {
    const defs = table.columns.map((col) => {
      let line = `  ${q(col.column_name)} ${mssqlType(col)}`;
      if (table.identity?.column === col.column_name) line += ` IDENTITY(${table.identity.nextValue}, 1)`;
      line += col.is_nullable === 'YES' ? ' NULL' : ' NOT NULL';
      const def = mssqlDefault(col);
      if (def) line += ` DEFAULT ${def}`;
      return line;
    });
    defs.push(`  CONSTRAINT ${q(`${table.name}_pkey`)} PRIMARY KEY (${table.pk.map(q).join(', ')})`);
    emit(`CREATE TABLE ${qt(table.name)} (`);
    emit(defs.join(',\n'));
    emit(');');
    emit('');
  }

  // ---------- 2. Datos ----------
  emit('-- ---------------------------------------------------------------------');
  emit('-- 2. DATOS (mismos IDs que en PostgreSQL)');
  emit('-- ---------------------------------------------------------------------');
  for (const table of tables) {
    const cols = table.columns;
    const { rows } = await pg.query({
      text: `SELECT ${cols.map(pgSelectExpr).join(', ')} FROM public."${table.name}" ORDER BY ${table.pk.map((c) => `"${c}"`).join(', ')}`,
      rowMode: 'array',
    });
    counts[table.name] = rows.length;
    emit(`-- ${table.name}: ${rows.length} filas`);
    if (!rows.length) { emit(''); continue; }

    if (table.identity) emit(`SET IDENTITY_INSERT ${qt(table.name)} ON;`);
    const colList = cols.map((c) => q(c.column_name)).join(', ');
    const BATCH = 500; // SQL Server admite hasta 1000 filas por VALUES
    for (let i = 0; i < rows.length; i += BATCH) {
      emit(`INSERT INTO ${qt(table.name)} (${colList}) VALUES`);
      const chunk = rows.slice(i, i + BATCH);
      chunk.forEach((row, r) => {
        const values = row.map((v, ci) => mssqlLiteral(cols[ci], v)).join(', ');
        emit(`  (${values})${r === chunk.length - 1 ? ';' : ','}`);
      });
    }
    if (table.identity) emit(`SET IDENTITY_INSERT ${qt(table.name)} OFF;`);
    emit('');
  }

  // ---------- 3. Índices ----------
  emit('-- ---------------------------------------------------------------------');
  emit('-- 3. ÍNDICES Y UNIQUE (duplicados de Postgres eliminados)');
  emit('-- ---------------------------------------------------------------------');
  for (const table of tables) {
    for (const ix of table.indexes) {
      emit(`CREATE ${ix.unique ? 'UNIQUE ' : ''}INDEX ${q(ix.name)} ON ${qt(table.name)} (${ix.columns.map(q).join(', ')});`);
    }
  }
  emit('');

  // ---------- 4. FKs ----------
  emit('-- ---------------------------------------------------------------------');
  emit('-- 4. FOREIGN KEYS');
  emit('-- Se crean como NO ACTION: las acciones ON DELETE de Postgres se emulan');
  emit('-- con triggers (paso 5) porque SQL Server no admite múltiples rutas de');
  emit('-- cascada (ej: churches → members → missions y churches → missions).');
  emit('-- ON UPDATE CASCADE se omite: los IDs nunca se modifican.');
  emit('-- ---------------------------------------------------------------------');
  for (const table of tables) {
    for (const fk of table.fks) {
      emit(`ALTER TABLE ${qt(table.name)} WITH CHECK ADD CONSTRAINT ${q(fk.name)} FOREIGN KEY (${fk.columns.map(q).join(', ')}) REFERENCES ${qt(fk.ref_table)} (${fk.ref_columns.map(q).join(', ')});`);
    }
  }
  emit('');

  // ---------- 5. Triggers de cascada ----------
  emit('-- ---------------------------------------------------------------------');
  emit('-- 5. ON DELETE CASCADE / SET NULL (emulado con INSTEAD OF DELETE)');
  emit('-- ---------------------------------------------------------------------');
  const DELETE_ACTIONS = { c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };
  for (const parent of tables) {
    const children = tables.flatMap((child) => child.fks
      .filter((fk) => fk.ref_table === parent.name && DELETE_ACTIONS[fk.on_delete])
      .map((fk) => ({ child, fk })));
    if (!children.length) continue;

    const match = (fk, alias) => fk.columns.map((c, i) => `d.${q(fk.ref_columns[i])} = ${alias}.${q(c)}`).join(' AND ');
    const body = [];
    // Primero SET NULL / DEFAULT, luego borrados en cascada (como lo haría Postgres)
    for (const { child, fk } of children.filter(({ fk }) => fk.on_delete !== 'c')) {
      const value = fk.on_delete === 'n' ? 'NULL' : 'DEFAULT';
      body.push(`  -- ${child.name}.${fk.columns.join(',')} ON DELETE ${DELETE_ACTIONS[fk.on_delete]}`);
      body.push(`  UPDATE x SET ${fk.columns.map((c) => `${q(c)} = ${value}`).join(', ')} FROM ${qt(child.name)} x WHERE EXISTS (SELECT 1 FROM deleted d WHERE ${match(fk, 'x')});`);
    }
    for (const { child, fk } of children.filter(({ fk }) => fk.on_delete === 'c')) {
      body.push(`  -- ${child.name}.${fk.columns.join(',')} ON DELETE CASCADE`);
      body.push(`  DELETE x FROM ${qt(child.name)} x WHERE EXISTS (SELECT 1 FROM deleted d WHERE ${match(fk, 'x')});`);
    }
    const pkMatch = parent.pk.map((c) => `d.${q(c)} = x.${q(c)}`).join(' AND ');
    body.push(`  DELETE x FROM ${qt(parent.name)} x WHERE EXISTS (SELECT 1 FROM deleted d WHERE ${pkMatch});`);

    const trigger = [
      `CREATE TRIGGER ${q(SCHEMA)}.${q(`trg_${parent.name}_on_delete`)} ON ${qt(parent.name)} INSTEAD OF DELETE AS`,
      'BEGIN',
      '  SET NOCOUNT ON;',
      ...body,
      'END',
    ].join('\n');
    emit(`EXEC(${nstr(trigger)});`);
    emit('');
  }

  // ---------- 6. Verificación ----------
  emit('-- ---------------------------------------------------------------------');
  emit('-- 6. VERIFICACIÓN DE CONTEOS (si no cuadra, se revierte todo)');
  emit('-- ---------------------------------------------------------------------');
  emit('DECLARE @esperado TABLE (tabla SYSNAME, filas INT);');
  emit(`INSERT INTO @esperado VALUES ${tables.map((t) => `(${nstr(t.name)}, ${counts[t.name]})`).join(', ')};`);
  emit('DECLARE @real TABLE (tabla SYSNAME, filas INT);');
  for (const table of tables) {
    emit(`INSERT INTO @real SELECT ${nstr(table.name)}, COUNT(*) FROM ${qt(table.name)};`);
  }
  emit('IF EXISTS (SELECT 1 FROM @esperado e LEFT JOIN @real r ON r.tabla = e.tabla WHERE r.filas IS NULL OR r.filas <> e.filas)');
  emit("  THROW 50001, N'Los conteos de filas no coinciden con PostgreSQL.', 1;");
  emit('');
  emit('COMMIT TRANSACTION;');
  emit(`PRINT N'OK: ${tables.length} tablas y ${Object.values(counts).reduce((a, b) => a + b, 0)} filas migradas al schema [${SCHEMA}].';`);
  emit('SELECT e.tabla, e.filas AS filas_postgres, r.filas AS filas_sqlserver FROM @esperado e JOIN @real r ON r.tabla = e.tabla ORDER BY e.tabla;');
  emit('END TRY');
  emit('BEGIN CATCH');
  emit('  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;');
  emit("  PRINT N'ERROR: se revirtió todo, no quedó nada creado.';");
  emit('  THROW;');
  emit('END CATCH;');

  await pg.query('COMMIT');
  await pg.end();

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // BOM para que SSMS lea bien los acentos (UTF-8)
  fs.writeFileSync(OUT, `﻿${out.join('\n')}\n`, 'utf8');

  console.log(`✅ Script generado: ${OUT}`);
  console.log(`   Schema destino: [${SCHEMA}]  |  Tablas: ${tables.length}  |  Filas: ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
  for (const table of tables) console.log(`   - ${table.name.padEnd(26)} ${String(counts[table.name]).padStart(6)} filas`);
}

main().catch((error) => {
  console.error('❌ Error generando el script:', error.message);
  process.exit(1);
});

/**
 * verify-migration.js - Compara CELDA POR CELDA PostgreSQL vs SQL Server
 *
 * Para cada tabla lee todas las filas en ambos lados, normaliza los valores
 * (fechas a microsegundos desde epoch, booleanos a true/false) y reporta
 * cualquier fila faltante, sobrante o con un valor distinto.
 *
 * USO:
 *   # Destino con la misma configuración que usa la app (DB_* en server/.env)
 *   node migrations/mssql/verify-migration.js
 *
 *   # Destino vía sqlcmd (útil para LocalDB, que no acepta TCP)
 *   node migrations/mssql/verify-migration.js --sqlcmd-server "(localdb)\MSSQLLocalDB" --sqlcmd-db tmdv_test
 *
 * Origen: PG_SOURCE_URL (variable de entorno o server/.env.migration).
 * Schema destino: --schema o DB_SCHEMA (por defecto "tmv").
 */
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.migration') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SCHEMA = argValue('--schema', process.env.DB_SCHEMA || 'tmv');
const SQLCMD_SERVER = argValue('--sqlcmd-server', null);
const SQLCMD_DB = argValue('--sqlcmd-db', null);

// Expresión Postgres → texto canónico
function pgExpr(col) {
  const c = `"${col.column_name}"`;
  switch (col.data_type) {
    case 'timestamp with time zone':
    case 'timestamp without time zone':
      return `(extract(epoch from ${c}) * 1000000)::bigint::text`;
    case 'date': return `to_char(${c}, 'YYYY-MM-DD')`;
    case 'boolean': return `${c}::text`;
    default: return `${c}::text`;
  }
}

// Expresión SQL Server → mismo texto canónico
function mssqlExpr(col) {
  const c = `[${col.column_name}]`;
  switch (col.data_type) {
    case 'timestamp with time zone':
      return `CAST(DATEDIFF_BIG(MICROSECOND, CAST('1970-01-01T00:00:00+00:00' AS DATETIMEOFFSET), ${c}) AS NVARCHAR(30))`;
    case 'timestamp without time zone':
      return `CAST(DATEDIFF_BIG(MICROSECOND, CAST('1970-01-01T00:00:00' AS DATETIME2), ${c}) AS NVARCHAR(30))`;
    case 'date': return `CONVERT(NCHAR(10), ${c}, 23)`;
    case 'boolean': return `CASE ${c} WHEN 1 THEN N'true' WHEN 0 THEN N'false' END`;
    case 'integer':
    case 'smallint':
    case 'bigint': return `CAST(${c} AS NVARCHAR(40))`;
    // Texto en hex UTF-16: evita que la consola/sqlcmd altere acentos o emojis
    default: return `CONVERT(VARCHAR(MAX), CAST(${c} AS VARBINARY(MAX)), 2)`;
  }
}

const isHexColumn = (col) => !['timestamp with time zone', 'timestamp without time zone', 'date', 'boolean', 'integer', 'smallint', 'bigint'].includes(col.data_type);
const decodeMssqlValue = (col, value) => (value != null && isHexColumn(col) ? Buffer.from(value, 'hex').toString('utf16le') : value);

async function createMssqlRunner() {
  if (SQLCMD_SERVER) {
    return {
      name: `sqlcmd ${SQLCMD_SERVER}/${SQLCMD_DB}`,
      // Devuelve un JSON por consulta (FOR JSON en una sola celda NVARCHAR(MAX))
      queryJson: async (sql) => {
        const output = execFileSync('sqlcmd', [
          '-S', SQLCMD_SERVER, '-d', SQLCMD_DB, '-f', '65001', '-x', '-b',
          '-y', '0',
          '-Q', `SET NOCOUNT ON; SELECT N'<<<' + ISNULL((${sql} FOR JSON PATH, INCLUDE_NULL_VALUES), N'[]') + N'>>>';`,
        ], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
        // Los marcadores separan el JSON de los encabezados que imprime sqlcmd
        return JSON.parse(output.match(/<<<([\s\S]*)>>>/)[1]);
      },
      close: async () => {},
    };
  }

  process.env.DB_DIALECT = 'mssql';
  const { sequelize } = require('../../config/database');
  await sequelize.authenticate();
  return {
    name: `${sequelize.config.host}/${sequelize.config.database}`,
    queryJson: async (sql) => {
      const rows = await sequelize.query(
        `SELECT ISNULL((${sql} FOR JSON PATH, INCLUDE_NULL_VALUES), N'[]') AS j`,
        { type: sequelize.QueryTypes.SELECT }
      );
      return JSON.parse(rows[0].j);
    },
    close: () => sequelize.close(),
  };
}

async function main() {
  const url = process.env.PG_SOURCE_URL;
  if (!url) throw new Error('Falta PG_SOURCE_URL (variable de entorno o server/.env.migration)');
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pg = new Client({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

  const mssql = await createMssqlRunner();
  console.log(`🔎 Comparando PostgreSQL → SQL Server (${mssql.name}, schema [${SCHEMA}])\n`);

  const { rows: columns } = await pg.query(`
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name, c.ordinal_position`);
  const tables = {};
  for (const col of columns) (tables[col.table_name] ||= []).push(col);

  let totalRows = 0;
  let totalCells = 0;
  const problems = [];

  for (const [table, cols] of Object.entries(tables)) {
    const { rows: pgRows } = await pg.query({
      text: `SELECT ${cols.map((c) => `${pgExpr(c)} AS "${c.column_name}"`).join(', ')} FROM public."${table}"`,
    });
    const msRows = await mssql.queryJson(
      `SELECT ${cols.map((c) => `${mssqlExpr(c)} AS [${c.column_name}]`).join(', ')} FROM [${SCHEMA}].[${table}]`
    );

    const key = (row) => String(row.id);
    const msById = new Map(msRows.map((row) => [key(row), row]));
    let diffs = 0;

    for (const pgRow of pgRows) {
      const msRow = msById.get(key(pgRow));
      if (!msRow) { problems.push(`${table} id=${pgRow.id}: falta en SQL Server`); diffs++; continue; }
      msById.delete(key(pgRow));
      for (const col of cols) {
        totalCells++;
        const a = pgRow[col.column_name];
        const b = decodeMssqlValue(col, msRow[col.column_name]);
        if ((a ?? null) !== (b ?? null)) {
          diffs++;
          problems.push(`${table} id=${pgRow.id} ${col.column_name}: PG=${JSON.stringify(a)} | MSSQL=${JSON.stringify(b)}`);
        }
      }
    }
    for (const extra of msById.keys()) { problems.push(`${table} id=${extra}: sobra en SQL Server`); diffs++; }

    totalRows += pgRows.length;
    console.log(`${diffs ? '❌' : '✅'} ${table.padEnd(26)} PG ${String(pgRows.length).padStart(5)} | MSSQL ${String(msRows.length).padStart(5)}${diffs ? `  (${diffs} diferencias)` : ''}`);
  }

  await pg.query('COMMIT');
  await pg.end();
  await mssql.close();

  console.log('');
  if (problems.length) {
    console.log(`❌ ${problems.length} diferencias encontradas:`);
    problems.slice(0, 50).forEach((p) => console.log(`   - ${p}`));
    if (problems.length > 50) console.log(`   ... y ${problems.length - 50} más`);
    process.exit(1);
  }
  console.log(`✅ Idénticas: ${Object.keys(tables).length} tablas, ${totalRows} filas, ${totalCells} celdas comparadas.`);
}

main().catch((error) => {
  console.error('❌ Error en la verificación:', error.message);
  process.exit(1);
});

# Migración PostgreSQL → SQL Server (schema `tmv`)

El backend funciona con los dos motores. `DB_DIALECT` elige cuál usar
(`mssql` por defecto —también si la variable está vacía— o `postgres`).
La web y la app móvil no cambian.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `export-pg-to-mssql.js` | Lee el esquema real y **todos** los datos de Postgres y genera un `.sql` para SQL Server |
| `verify-migration.js` | Compara celda por celda Postgres contra SQL Server |
| `run-mssql.js` | Migraciones de arranque en modo SQL Server (lo llama `migrations/run.js`) |

La conexión de **origen** va en `server/.env.migration` (ignorado por Git):

```
PG_SOURCE_URL=postgresql://usuario:password@host/base
```

## Pasos para cambiar a Somee

1. **Congelar escrituras** en la app actual (avisar a los usuarios) para no perder datos nuevos.
2. Generar el script con los datos al día:
   ```bash
   cd server
   node migrations/mssql/export-pg-to-mssql.js
   ```
   Queda en `backups/mssql_tmv_<fecha>.sql` (contiene datos personales, no se sube a Git).
3. Ejecutarlo en Somee (SSMS, Azure Data Studio o sqlcmd):
   ```bash
   sqlcmd -S <servidor>.mssql.somee.com -U <usuario> -P <password> -d <base> -f 65001 -x -i ../backups/mssql_tmv_<fecha>.sql
   ```
   Corre en una sola transacción: si algo falla no queda nada creado. Si las tablas
   ya existen en `tmv`, se detiene sin tocar nada.
4. Verificar (con la conexión de Somee en `server/.env`):
   ```bash
   node migrations/mssql/verify-migration.js
   ```
   Debe terminar en `✅ Idénticas`.
5. En Render, definir en el servicio `MSSQL_CONNECTION_STRING`
   (o `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`). Como `mssql` es el motor por
   defecto, no hace falta definir `DB_DIALECT`.
   Para volver a Postgres basta con `DB_DIALECT=postgres`.

## Diferencias que maneja el código

- **Cascadas:** SQL Server no admite varias rutas de `ON DELETE CASCADE`, así que las FK
  se crean sin acción y las cascadas/`SET NULL` de Postgres se emulan con triggers
  `INSTEAD OF DELETE` (`trg_<tabla>_on_delete`).
- **IDs:** se conservan los mismos y los nuevos siguen donde iba cada secuencia.
- **Fechas:** `timestamptz` → `DATETIMEOFFSET` con offset `-05:00` (Panamá); `date` → `DATE`.
- **JSONB** (`bible_club_groups.levels`) → `NVARCHAR(MAX)` con JSON, convertido en el modelo.
- **UNIQUE duplicados** que dejó `sync({ alter: true })` en Postgres se crean una sola vez.

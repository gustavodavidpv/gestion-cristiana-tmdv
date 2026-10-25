/**
 * run-mssql.js - Migraciones para SQL Server (DB_DIALECT=mssql)
 *
 * Lo invoca migrations/run.js cuando DB_DIALECT=mssql.
 *
 * El esquema completo (tablas, índices, FK, triggers de cascada) se crea una
 * sola vez con el script de export-pg-to-mssql.js. Los pasos legacy de run.js
 * (columnas y FK agregadas a mano sobre Postgres) no aplican aquí.
 *
 * PASOS:
 * 1. sequelize.sync() plano — crea solo tablas nuevas que se agreguen al modelo
 * 2. Asegurar roles del sistema y permisos por defecto
 * 3. Recalcular estadísticas (mismas reglas que el PASO 6 de run.js, en T-SQL)
 */
const { sequelize } = require('../../models');
const { qt } = require('../../config/database');
const { ensureSystemRoles, ensureDefaultRolePermissions } = require('../../utils/roleSetup');

const runMssqlMigrations = async () => {
  try {
    console.log('🔄 Ejecutando migraciones (SQL Server)...');

    console.log('🔄 Sincronizando modelos con BD (modo seguro, sin alter)...');
    await sequelize.sync();
    console.log('✅ Sync completado.');

    await ensureSystemRoles();
    await ensureDefaultRolePermissions();
    console.log('✅ Roles del sistema y permisos por defecto verificados.');

    try {
      console.log('📊 Recalculando estadísticas...');
      const currentYear = new Date().getFullYear();
      const roleCount = (role) => `COALESCE((
            SELECT COUNT(*) FROM ${qt('members')} m
            WHERE m.church_id = c.id AND m.church_role = N'${role}'
          ), 0)`;

      // Contadores de eventos
      await sequelize.query(`
        UPDATE e SET
          attendees_count = COALESCE((
            SELECT COUNT(*) FROM ${qt('event_attendees')} ea
            WHERE ea.event_id = e.id AND ea.attended = 1
          ), 0),
          faith_decisions = COALESCE((
            SELECT COUNT(*) FROM ${qt('event_attendees')} ea
            WHERE ea.event_id = e.id AND ea.made_faith_decision = 1
          ), 0)
        FROM ${qt('events')} e
      `);

      // Decisiones de fe por iglesia (año en hora de Panamá: las fechas se guardan con offset -05:00)
      await sequelize.query(`
        UPDATE c SET
          faith_decisions_year = COALESCE((
            SELECT COUNT(*)
            FROM ${qt('event_attendees')} ea
            JOIN ${qt('events')} e ON ea.event_id = e.id
            WHERE e.church_id = c.id
              AND ea.made_faith_decision = 1
              AND YEAR(SWITCHOFFSET(e.start_date, '-05:00')) = :year
          ), 0),
          faith_decisions_ref_year = :year
        FROM ${qt('churches')} c
      `, { replacements: { year: currentYear } });

      // Promedio asistencia semanal
      await sequelize.query(`
        UPDATE c SET
          avg_weekly_attendance = COALESCE((
            SELECT ROUND(AVG(w.attendance_count * 1.0), 0)
            FROM ${qt('weekly_attendances')} w
            WHERE w.church_id = c.id
          ), 0)
        FROM ${qt('churches')} c
      `).catch(() => {});

      // Contadores de cargos ministeriales (legacy church_role)
      await sequelize.query(`
        UPDATE c SET
          ordained_preachers = ${roleCount('Predicador Ordenado')},
          unordained_preachers = ${roleCount('Predicador No Ordenado')},
          ordained_deacons = ${roleCount('Diácono Ordenado')},
          unordained_deacons = ${roleCount('Diácono No Ordenado')}
        FROM ${qt('churches')} c
      `).catch(() => {});

      // Membresía total
      await sequelize.query(`
        UPDATE c SET
          membership_count = COALESCE((
            SELECT COUNT(*) FROM ${qt('members')} m WHERE m.church_id = c.id
          ), 0)
        FROM ${qt('churches')} c
      `).catch(() => {});

      console.log('✅ Estadísticas recalculadas.');
    } catch (statsError) {
      console.warn('⚠️  Error al recalcular estadísticas:', statsError.message);
    }

    console.log('');
    console.log('✅ Migraciones ejecutadas correctamente (SQL Server).');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migraciones:', error.message);
    process.exit(1);
  }
};

module.exports = { runMssqlMigrations };

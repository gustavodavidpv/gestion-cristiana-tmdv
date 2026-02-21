const { sequelize } = require('../models');

const runMigrations = async () => {
  try {
    console.log('🔄 Ejecutando migraciones...');

    // =========================================================
    // PASO 1: Limpiar duplicados en event_attendees ANTES de sync
    // =========================================================
    try {
      console.log('🧹 Limpiando duplicados en event_attendees...');

      const [tables] = await sequelize.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'event_attendees'`
      );

      if (tables.length > 0) {
        const [dupes] = await sequelize.query(`
          SELECT event_id, member_id, COUNT(*) as cnt
          FROM event_attendees
          GROUP BY event_id, member_id
          HAVING COUNT(*) > 1
        `);

        if (dupes.length > 0) {
          console.log(`⚠️  Se encontraron ${dupes.length} combinaciones duplicadas. Limpiando...`);
          await sequelize.query(`
            DELETE FROM event_attendees
            WHERE id NOT IN (
              SELECT MIN(id)
              FROM event_attendees
              GROUP BY event_id, member_id
            )
          `);
          console.log('✅ Duplicados eliminados.');
        } else {
          console.log('✅ No hay duplicados en event_attendees.');
        }

        // Eliminar índice si existe para que sync lo recree limpio
        await sequelize.query('DROP INDEX IF EXISTS "unique_event_member"').catch(() => {});
      }
    } catch (cleanError) {
      console.warn('⚠️  Aviso al limpiar duplicados:', cleanError.message);
    }

    // =========================================================
    // PASO 2: Eliminar índice unique_church_week si existe
    // (por si hay duplicados en weekly_attendances)
    // =========================================================
    try {
      await sequelize.query('DROP INDEX IF EXISTS "unique_church_week"').catch(() => {});
    } catch (e) { /* tabla puede no existir aún */ }

    // =========================================================
    // PASO 3: Sincronizar modelos con la BD
    // =========================================================
    await sequelize.sync({ alter: true });

    // =========================================================
    // PASO 4: Recalcular TODAS las estadísticas
    // =========================================================
    try {
      console.log('📊 Recalculando estadísticas...');
      const currentYear = new Date().getFullYear();

      // 4a. Recalcular contadores de eventos
      await sequelize.query(`
        UPDATE events SET
          attendees_count = COALESCE((
            SELECT COUNT(*) FROM event_attendees 
            WHERE event_attendees.event_id = events.id AND event_attendees.attended = true
          ), 0),
          faith_decisions = COALESCE((
            SELECT COUNT(*) FROM event_attendees 
            WHERE event_attendees.event_id = events.id AND event_attendees.made_faith_decision = true
          ), 0)
      `);

      // 4b. Recalcular decisiones de fe por iglesia
      await sequelize.query(`
        UPDATE churches SET
          faith_decisions_year = COALESCE((
            SELECT COUNT(*) 
            FROM event_attendees ea
            JOIN events e ON ea.event_id = e.id
            WHERE e.church_id = churches.id
              AND ea.made_faith_decision = true
              AND EXTRACT(YEAR FROM e.start_date) = :year
          ), 0),
          faith_decisions_ref_year = :year
      `, { replacements: { year: currentYear } });

      // 4c. Recalcular promedio de asistencia semanal
      await sequelize.query(`
        UPDATE churches SET
          avg_weekly_attendance = COALESCE((
            SELECT ROUND(AVG(attendance_count))
            FROM weekly_attendances
            WHERE weekly_attendances.church_id = churches.id
          ), 0)
      `).catch(() => { /* tabla puede estar vacía */ });

      // 4d. Recalcular contadores de cargos ministeriales desde miembros
      await sequelize.query(`
        UPDATE churches SET
          ordained_preachers = COALESCE((
            SELECT COUNT(*) FROM members 
            WHERE members.church_id = churches.id AND members.church_role = 'Predicador Ordenado'
          ), 0),
          unordained_preachers = COALESCE((
            SELECT COUNT(*) FROM members 
            WHERE members.church_id = churches.id AND members.church_role = 'Predicador No Ordenado'
          ), 0),
          ordained_deacons = COALESCE((
            SELECT COUNT(*) FROM members 
            WHERE members.church_id = churches.id AND members.church_role = 'Diácono Ordenado'
          ), 0),
          unordained_deacons = COALESCE((
            SELECT COUNT(*) FROM members 
            WHERE members.church_id = churches.id AND members.church_role = 'Diácono No Ordenado'
          ), 0)
      `).catch(() => { /* columna church_role puede no existir aún */ });

      // 4e. Recalcular membresía total desde miembros
      await sequelize.query(`
        UPDATE churches SET
          membership_count = COALESCE((
            SELECT COUNT(*) FROM members 
            WHERE members.church_id = churches.id
          ), 0)
      `).catch(() => { /* tabla members puede estar vacía */ });

      console.log('✅ Estadísticas recalculadas.');
    } catch (statsError) {
      console.warn('⚠️  Error al recalcular estadísticas:', statsError.message);
    }

    console.log('');
    console.log('✅ Migraciones ejecutadas correctamente.');
    console.log('📋 Tablas:');
    console.log('   - roles, users, churches');
    console.log('   - members (+ birth_date, church_role, Infante)');
    console.log('   - missions (+ responsible_name, responsible_phone)');
    console.log('   - white_fields (+ responsible_name, responsible_phone)');
    console.log('   - events, event_attendees (UNIQUE event_id + member_id)');
    console.log('   - weekly_attendances (UNIQUE church_id + week_date)');
    console.log('   - minutes, minute_attendees, motions, motion_voters');
    console.log('📊 Estadísticas recalculadas: membership, cargos, asistencia, decisiones de fe');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migraciones:', error);
    console.error(error?.stack);
    process.exit(1);
  }
};

runMigrations();

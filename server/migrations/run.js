/**
 * run.js - Script de migraciones para Gestión Cristiana TMDV
 * 
 * Ejecuta: npm run db:migrate (o: cd server && node migrations/run.js)
 * 
 * PASOS:
 * 1. Limpiar duplicados en event_attendees
 * 2. Asegurar rol SuperAdmin
 * 3. Pre-crear columnas/FK problemáticas ANTES de sync (evita bug de Sequelize)
 * 4. sequelize.sync({ alter: true }) — sincroniza modelos con BD
 * 5. Recalcular estadísticas
 * 
 * NOTA SOBRE EL BUG DE SEQUELIZE:
 * Sequelize genera SQL inválido al hacer ALTER COLUMN con REFERENCES en PostgreSQL.
 * Ejemplo: ALTER COLUMN "position_id" SET DEFAULT NULL REFERENCES "ministerial_positions"...
 * PostgreSQL NO permite REFERENCES dentro de ALTER COLUMN (solo en CREATE TABLE).
 * Solución: crear la columna y FK manualmente antes del sync.
 */
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

        // Eliminar índice viejo para que sync lo recree limpio
        await sequelize.query('DROP INDEX IF EXISTS "unique_event_member"').catch(() => {});
      }
    } catch (cleanError) {
      console.warn('⚠️  Aviso al limpiar duplicados:', cleanError.message);
    }

    // =========================================================
    // PASO 2: Eliminar índice unique_church_week si existe
    // =========================================================
    try {
      await sequelize.query('DROP INDEX IF EXISTS "unique_church_week"').catch(() => {});
    } catch (e) { /* tabla puede no existir aún */ }

    // =========================================================
    // PASO 3: Asegurar que el rol SuperAdmin existe ANTES de sync
    // Las columnas de timestamp en roles usan underscored (created_at)
    // =========================================================
    try {
      const [rolesTable] = await sequelize.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'roles'`
      );
      if (rolesTable.length > 0) {
        // Detectar si usa created_at o "createdAt"
        const [cols] = await sequelize.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'roles' AND column_name IN ('created_at', 'createdAt')
        `);
        const tsCol = cols.length > 0 ? cols[0].column_name : 'created_at';
        const tsColUp = tsCol === 'created_at' ? 'updated_at' : 'updatedAt';

        await sequelize.query(`
          INSERT INTO roles (name, description, "${tsCol}", "${tsColUp}")
          VALUES ('SuperAdmin', 'Acceso total cross-tenant', NOW(), NOW())
          ON CONFLICT (name) DO NOTHING
        `);
        console.log('✅ Rol SuperAdmin asegurado.');
      }
    } catch (e) {
      console.warn('⚠️  Aviso al insertar SuperAdmin:', e.message);
    }

    // =========================================================
    // PASO 4: Pre-crear columnas/FK problemáticas manualmente
    //
    // Sequelize sync({ alter: true }) genera SQL inválido para
    // ALTER COLUMN con REFERENCES en PostgreSQL. Solución:
    // crear las columnas y FK aquí ANTES del sync.
    // =========================================================
    console.log('🔧 Pre-creando columnas y FK...');

    // --- 4a. Tabla ministerial_positions (debe existir antes de la FK) ---
    try {
      const [mpTable] = await sequelize.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'ministerial_positions'`
      );
      if (mpTable.length === 0) {
        await sequelize.query(`
          CREATE TABLE ministerial_positions (
            id SERIAL PRIMARY KEY,
            church_id INTEGER NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `);
        console.log('   ✅ Tabla ministerial_positions creada.');
      }
    } catch (e) {
      console.warn('   ⚠️  ministerial_positions:', e.message);
    }

    // --- 4b. Columna members.position_id + FK ---
    try {
      const [posCol] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'members' AND column_name = 'position_id'
      `);

      if (posCol.length === 0) {
        // Agregar columna
        await sequelize.query(`
          ALTER TABLE members ADD COLUMN position_id INTEGER DEFAULT NULL
        `);
        console.log('   ✅ Columna members.position_id agregada.');
      }

      // Agregar FK si no existe
      const [fks] = await sequelize.query(`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'members' AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%position_id%'
      `);
      if (fks.length === 0) {
        await sequelize.query(`
          ALTER TABLE members
          ADD CONSTRAINT members_position_id_fkey
          FOREIGN KEY (position_id) REFERENCES ministerial_positions(id)
          ON DELETE SET NULL ON UPDATE CASCADE
        `);
        console.log('   ✅ FK members.position_id → ministerial_positions creada.');
      }
    } catch (e) {
      console.warn('   ⚠️  members.position_id:', e.message);
    }

    // --- 4c. Columnas de branding en churches ---
    try {
      const [ltCol] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'churches' AND column_name = 'login_title'
      `);
      if (ltCol.length === 0) {
        await sequelize.query(`ALTER TABLE churches ADD COLUMN login_title VARCHAR(200)`);
        console.log('   ✅ Columna churches.login_title agregada.');
      }

      const [llCol] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'churches' AND column_name = 'login_logo_url'
      `);
      if (llCol.length === 0) {
        await sequelize.query(`ALTER TABLE churches ADD COLUMN login_logo_url VARCHAR(500)`);
        console.log('   ✅ Columna churches.login_logo_url agregada.');
      }
    } catch (e) {
      console.warn('   ⚠️  churches branding columns:', e.message);
    }

    // --- 4d. Columna members.birth_date ---
    try {
      const [bdCol] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'members' AND column_name = 'birth_date'
      `);
      if (bdCol.length === 0) {
        await sequelize.query(`ALTER TABLE members ADD COLUMN birth_date DATE`);
        console.log('   ✅ Columna members.birth_date agregada.');
      }
    } catch (e) {
      console.warn('   ⚠️  members.birth_date:', e.message);
    }

    // --- 4e. Columna members.church_role ---
    // Ahora usa VARCHAR(100) para soportar nombres de cargos dinámicos más largos
    try {
      const [crCol] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'members' AND column_name = 'church_role'
      `);
      if (crCol.length === 0) {
        await sequelize.query(`ALTER TABLE members ADD COLUMN church_role VARCHAR(100) DEFAULT NULL`);
        console.log('   ✅ Columna members.church_role agregada.');
      } else {
        // Ampliar a VARCHAR(100) si ya existía como VARCHAR(30)
        await sequelize.query(`ALTER TABLE members ALTER COLUMN church_role TYPE VARCHAR(100)`);
      }
    } catch (e) {
      console.warn('   ⚠️  members.church_role:', e.message);
    }

    // --- 4f. Tabla minute_files ---
    try {
      const [mfTable] = await sequelize.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'minute_files'`
      );
      if (mfTable.length === 0) {
        await sequelize.query(`
          CREATE TABLE minute_files (
            id SERIAL PRIMARY KEY,
            minute_id INTEGER NOT NULL REFERENCES minutes(id) ON DELETE CASCADE,
            file_url VARCHAR(500) NOT NULL,
            original_name VARCHAR(300) NOT NULL,
            file_size INTEGER,
            file_type VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `);
        console.log('   ✅ Tabla minute_files creada.');
      }
    } catch (e) {
      console.warn('   ⚠️  minute_files:', e.message);
    }

    // --- 4g. Tabla weekly_attendances ---
    try {
      const [waTable] = await sequelize.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'weekly_attendances'`
      );
      if (waTable.length === 0) {
        await sequelize.query(`
          CREATE TABLE weekly_attendances (
            id SERIAL PRIMARY KEY,
            church_id INTEGER NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
            week_date DATE NOT NULL,
            attendance_count INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `);
        console.log('   ✅ Tabla weekly_attendances creada.');
      }
    } catch (e) {
      console.warn('   ⚠️  weekly_attendances:', e.message);
    }

    // --- 4h. Columnas de roles de culto en events ---
    // preacher_id, worship_leader_id, singer_id → FK a members
    // Estos campos almacenan quién predica (P), dirige (D) y canta (C)
    // en eventos tipo Culto.
    const cultoRoleCols = [
      { col: 'preacher_id', fk: 'events_preacher_id_fkey' },
      { col: 'worship_leader_id', fk: 'events_worship_leader_id_fkey' },
      { col: 'singer_id', fk: 'events_singer_id_fkey' },
    ];
    for (const { col, fk } of cultoRoleCols) {
      try {
        const [colExists] = await sequelize.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'events' AND column_name = '${col}'
        `);
        if (colExists.length === 0) {
          await sequelize.query(`ALTER TABLE events ADD COLUMN ${col} INTEGER DEFAULT NULL`);
          console.log(`   ✅ Columna events.${col} agregada.`);
        }
        // FK: ON DELETE SET NULL para que si se borra el miembro no se borre el evento
        const [fkExists] = await sequelize.query(`
          SELECT constraint_name FROM information_schema.table_constraints
          WHERE table_name = 'events' AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = '${fk}'
        `);
        if (fkExists.length === 0) {
          await sequelize.query(`
            ALTER TABLE events ADD CONSTRAINT ${fk}
            FOREIGN KEY (${col}) REFERENCES members(id)
            ON DELETE SET NULL ON UPDATE CASCADE
          `);
          console.log(`   ✅ FK events.${col} → members creada.`);
        }
      } catch (e) {
        console.warn(`   ⚠️  events.${col}:`, e.message);
      }
    }

    // --- 4i. Columnas de horarios de notificación en churches ---
    // notification_day_before_hour y notification_same_day_hour
    // permiten configurar a qué hora se envían los recordatorios WhatsApp
    const notifCols = [
      { col: 'notification_day_before_hour', def: '18' },
      { col: 'notification_same_day_hour', def: '7' },
    ];
    for (const { col, def } of notifCols) {
      try {
        const [colExists] = await sequelize.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'churches' AND column_name = '${col}'
        `);
        if (colExists.length === 0) {
          await sequelize.query(`ALTER TABLE churches ADD COLUMN ${col} INTEGER DEFAULT ${def}`);
          console.log(`   ✅ Columna churches.${col} agregada (default: ${def}).`);
        }
      } catch (e) {
        console.warn(`   ⚠️  churches.${col}:`, e.message);
      }
    }

    // =========================================================
    // PASO 5: Sincronizar modelos con la BD
    //
    // Como ya creamos las columnas/FK problemáticas en el paso 4,
    // Sequelize no intentará ALTER COLUMN con REFERENCES (ya existe).
    // =========================================================
    console.log('🔄 Sincronizando modelos con BD...');
    await sequelize.sync({ alter: true });
    console.log('✅ Sync completado.');

    // =========================================================
    // PASO 6: Recalcular TODAS las estadísticas
    // =========================================================
    try {
      console.log('📊 Recalculando estadísticas...');
      const currentYear = new Date().getFullYear();

      // 6a. Contadores de eventos
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

      // 6b. Decisiones de fe por iglesia
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

      // 6c. Promedio asistencia semanal
      await sequelize.query(`
        UPDATE churches SET
          avg_weekly_attendance = COALESCE((
            SELECT ROUND(AVG(attendance_count))
            FROM weekly_attendances
            WHERE weekly_attendances.church_id = churches.id
          ), 0)
      `).catch(() => {});

      // 6d. Contadores de cargos ministeriales (legacy church_role)
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
      `).catch(() => {});

      // 6e. Membresía total
      await sequelize.query(`
        UPDATE churches SET
          membership_count = COALESCE((
            SELECT COUNT(*) FROM members 
            WHERE members.church_id = churches.id
          ), 0)
      `).catch(() => {});

      console.log('✅ Estadísticas recalculadas.');
    } catch (statsError) {
      console.warn('⚠️  Error al recalcular estadísticas:', statsError.message);
    }

    console.log('');
    console.log('✅ Migraciones ejecutadas correctamente.');
    console.log('📋 Tablas:');
    console.log('   - roles (+ SuperAdmin), users, churches (+ login_title, login_logo_url)');
    console.log('   - members (+ birth_date, church_role, position_id FK → ministerial_positions)');
    console.log('   - ministerial_positions (cargos por iglesia)');
    console.log('   - missions, white_fields');
    console.log('   - events (+ preacher_id, worship_leader_id, singer_id FK → members)');
    console.log('   - event_attendees (UNIQUE event_id + member_id)');
    console.log('   - weekly_attendances (UNIQUE church_id + week_date)');
    console.log('   - minutes, minute_attendees, motions, motion_voters');
    console.log('   - minute_files (archivos de actas)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migraciones:', error.message);
    process.exit(1);
  }
};

runMigrations();

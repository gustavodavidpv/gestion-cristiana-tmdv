-- =====================================================================
-- Club Bíblico — Carga inicial del Salón A
--
-- QUÉ HACE
--   1. Crea el grupo "Salón A" (si no existe)
--   2. Crea los 29 participantes de la hoja "Saldo por participante"
--   3. Carga el saldo previo de cada uno + el bono parejo de +30
--   4. Carga los puntos de la lista de asistencia del sábado
--
-- REQUISITO
--   Las tablas bible_club_* deben existir. En Render se crean solas en el
--   deploy (startCommand corre migrations/run.js). Si aún no desplegaste,
--   hazlo antes de correr este script.
--
-- ES SEGURO CORRERLO VARIAS VECES
--   Cada INSERT está protegido: si el grupo, el participante o el
--   movimiento ya existen, no se duplica nada.
--
-- CÓMO CORRERLO
--   psql "<External Database URL de Render>" -f club-biblico-carga-inicial.sql
--   ...o pegar todo el contenido en cualquier cliente SQL (pgAdmin, DBeaver,
--   TablePlus, Beekeeper).
-- =====================================================================

SET client_encoding TO 'UTF8';

DO $$
DECLARE
  -- ⚙️ CONFIGURACIÓN -------------------------------------------------
  -- Si tienes más de una iglesia, escribe aquí su id (ej: 2).
  -- Déjalo en NULL para usar la primera iglesia registrada.
  v_church_id     INT  := NULL;

  -- Fecha del saldo que traían antes de la clase
  v_fecha_saldos  DATE := DATE '2026-09-11';
  -- Fecha de la clase (sábado) de la lista de asistencia
  v_fecha_clase   DATE := DATE '2026-09-12';
  -- Bono parejo que aparece en la columna "+BONO"
  v_bono          INT  := 30;
  -- -------------------------------------------------------------------

  v_group_id      INT;
  v_student_id    INT;
  v_nuevos        INT := 0;
  v_saldos        INT := 0;
  v_clase         INT := 0;
  r               RECORD;
BEGIN
  -- ===== 1. Iglesia destino =====
  IF v_church_id IS NULL THEN
    SELECT id INTO v_church_id FROM churches ORDER BY id LIMIT 1;
  END IF;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'No hay iglesias en la base de datos.';
  END IF;
  RAISE NOTICE 'Iglesia destino: id %', v_church_id;

  -- ===== 2. Grupo "Salón A" =====
  SELECT id INTO v_group_id
    FROM bible_club_groups
   WHERE church_id = v_church_id AND name = 'Salón A';

  IF v_group_id IS NULL THEN
    INSERT INTO bible_club_groups (church_id, name, description, is_active, created_at, updated_at)
    VALUES (v_church_id, 'Salón A', 'Sección de adolescentes — Club Bíblico', TRUE, NOW(), NOW())
    RETURNING id INTO v_group_id;
    RAISE NOTICE 'Grupo "Salón A" creado (id %)', v_group_id;
  ELSE
    RAISE NOTICE 'Grupo "Salón A" ya existía (id %)', v_group_id;
  END IF;

  -- ===== 3. Participantes + saldo acumulado + bono =====
  FOR r IN
    SELECT nombre, puntos FROM (VALUES
      ('David Castillo',    990),
      ('Jesseth Pimentel',  510),
      ('Amir de Gracia',    485),
      ('Jafeth Pimentel',   410),
      ('Gilberto Lum',      350),
      ('Yeimar De Gracia',  320),
      ('Eliath Davila',     295),
      ('Luis Rodriguez',    230),
      ('David Lum',         225),
      ('Cristopher Aguero', 180),
      ('Joseph Molina',     125),
      ('Justin Pimentel',   125),
      ('Joseph Pimentel',   105),
      ('Josafat Varona',     95),
      ('Josue Varona',       85),
      ('Jose Fernandez',     85),
      ('Anthony Alvarado',   70),
      ('Nijah Vans',         55),
      ('Carlos',             45),
      ('Raul Aguilar',       40),
      ('Eliecer Moran',      35),
      ('Yeraldo Mosquera',   25),
      ('Carlos Giron',       20),
      ('Nehemias',            5),
      ('Luis',                0),
      ('Angelo',              0),
      ('Hamilton',            0),
      ('Bryan Martinez',      0),
      ('David de Gracia',     0)
    ) AS t(nombre, puntos)
  LOOP
    -- Participante
    SELECT id INTO v_student_id
      FROM bible_club_students
     WHERE group_id = v_group_id AND full_name = r.nombre;

    IF v_student_id IS NULL THEN
      INSERT INTO bible_club_students (church_id, group_id, full_name, is_active, created_at, updated_at)
      VALUES (v_church_id, v_group_id, r.nombre, TRUE, NOW(), NOW())
      RETURNING id INTO v_student_id;
      v_nuevos := v_nuevos + 1;
    END IF;

    -- Saldo acumulado previo
    IF r.puntos > 0 AND NOT EXISTS (
      SELECT 1 FROM bible_club_transactions
       WHERE student_id = v_student_id
         AND reason = 'Saldo acumulado'
         AND activity_date = v_fecha_saldos
    ) THEN
      INSERT INTO bible_club_transactions
        (student_id, church_id, type, points, activity_date, reason, notes, created_at, updated_at)
      VALUES
        (v_student_id, v_church_id, 'adjust', r.puntos, v_fecha_saldos, 'Saldo acumulado',
         'Carga inicial desde la hoja "Saldo por participante"', NOW(), NOW());
      v_saldos := v_saldos + 1;
    END IF;

    -- Bono parejo de +30 (columna "+BONO")
    IF NOT EXISTS (
      SELECT 1 FROM bible_club_transactions
       WHERE student_id = v_student_id
         AND reason = 'Bono'
         AND activity_date = v_fecha_saldos
    ) THEN
      INSERT INTO bible_club_transactions
        (student_id, church_id, type, points, activity_date, reason, notes, created_at, updated_at)
      VALUES
        (v_student_id, v_church_id, 'earn', v_bono, v_fecha_saldos, 'Bono',
         'Bono incluido en la columna "+BONO" de la hoja de saldos', NOW(), NOW());
    END IF;
  END LOOP;

  RAISE NOTICE 'Participantes nuevos: % — saldos cargados: %', v_nuevos, v_saldos;

  -- ===== 4. Puntos de la lista de asistencia del sábado =====
  FOR r IN
    SELECT nombre, puntos, desglose FROM (VALUES
      ('David Castillo',    125, '10+10+5+100'),
      ('Luis Rodriguez',    130, '20+10+100'),
      ('Justin Pimentel',   140, '20+20+100'),
      ('Bryan Martinez',    145, '20+25+100'),
      ('Eliath Davila',     120, '25+20(I)+25+50'),
      ('Jafeth Pimentel',   110, '10+100'),
      ('Jesseth Pimentel',  150, '25+25+100'),
      ('Cristopher Aguero',  50, '50'),
      ('Joseph Pimentel',   100, '100')
    ) AS t(nombre, puntos, desglose)
  LOOP
    SELECT id INTO v_student_id
      FROM bible_club_students
     WHERE group_id = v_group_id AND full_name = r.nombre;

    IF v_student_id IS NULL THEN
      RAISE NOTICE 'Participante no encontrado, se omite: %', r.nombre;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM bible_club_transactions
       WHERE student_id = v_student_id
         AND activity_date = v_fecha_clase
         AND reason = 'Lista de asistencia'
    ) THEN
      INSERT INTO bible_club_transactions
        (student_id, church_id, type, points, activity_date, reason, notes, created_at, updated_at)
      VALUES
        (v_student_id, v_church_id, 'earn', r.puntos, v_fecha_clase, 'Lista de asistencia',
         'Desglose de la hoja: ' || r.desglose, NOW(), NOW());
      v_clase := v_clase + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Movimientos de la clase del %: %', v_fecha_clase, v_clase;
  RAISE NOTICE 'Listo.';
END $$;

-- =====================================================================
-- VERIFICACIÓN: saldo final de cada participante
-- =====================================================================
SELECT
  ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(t.points), 0) DESC, s.full_name) AS "#",
  s.full_name                                                       AS participante,
  COALESCE(SUM(t.points), 0)                                        AS saldo,
  COALESCE(SUM(CASE WHEN t.points > 0 THEN t.points ELSE 0 END), 0) AS total_ganado
FROM bible_club_students s
LEFT JOIN bible_club_transactions t ON t.student_id = s.id
JOIN bible_club_groups g ON g.id = s.group_id
WHERE g.name = 'Salón A'
GROUP BY s.id, s.full_name
ORDER BY saldo DESC, s.full_name;

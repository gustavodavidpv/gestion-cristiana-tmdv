/**
 * seed-bible-club.js - Carga inicial del Club Bíblico (Salón A)
 *
 * Ejecutar:  cd server && npm run seed:bible-club
 * Opcional:  CHURCH_ID=2 CLUB_DATE=2026-09-12 npm run seed:bible-club
 *
 * Carga dos cosas:
 *  1) El saldo que cada participante traía en la hoja "Saldo por participante":
 *     un movimiento "Saldo acumulado" con la columna PUNTOS + un movimiento
 *     "Bono" de +30 (el bono parejo que tenía la columna +BONO).
 *  2) Los puntos de la última lista de asistencia (sábado), con el desglose
 *     escrito a mano guardado en las notas de cada movimiento.
 *
 * Es idempotente: si el grupo/participante/movimiento ya existe, no lo duplica.
 */
require('dotenv').config();
const { sequelize, Church, User, BibleClubGroup, BibleClubStudent, BibleClubTransaction } = require('../models');

/** Bono parejo que aparece en la columna "+BONO" de la hoja de saldos */
const BONO_INICIAL = 30;

/**
 * Saldo previo de cada participante (columna PUNTOS de la hoja de saldos).
 * El orden es el mismo de la hoja.
 */
const SALDOS_INICIALES = [
  { name: 'David Castillo', points: 990 },
  { name: 'Jesseth Pimentel', points: 510 },
  { name: 'Amir de Gracia', points: 485 },
  { name: 'Jafeth Pimentel', points: 410 },
  { name: 'Gilberto Lum', points: 350 },
  { name: 'Yeimar De Gracia', points: 320 },
  { name: 'Eliath Davila', points: 295 },
  { name: 'Luis Rodriguez', points: 230 },
  { name: 'David Lum', points: 225 },
  { name: 'Cristopher Aguero', points: 180 },
  { name: 'Joseph Molina', points: 125 },
  { name: 'Justin Pimentel', points: 125 },
  { name: 'Joseph Pimentel', points: 105 },
  { name: 'Josafat Varona', points: 95 },
  { name: 'Josue Varona', points: 85 },
  { name: 'Jose Fernandez', points: 85 },
  { name: 'Anthony Alvarado', points: 70 },
  { name: 'Nijah Vans', points: 55 },
  { name: 'Carlos', points: 45 },
  { name: 'Raul Aguilar', points: 40 },
  { name: 'Eliecer Moran', points: 35 },
  { name: 'Yeraldo Mosquera', points: 25 },
  { name: 'Carlos Giron', points: 20 },
  { name: 'Nehemias', points: 5 },
  { name: 'Luis', points: 0 },
  { name: 'Angelo', points: 0 },
  { name: 'Hamilton', points: 0 },
  { name: 'Bryan Martinez', points: 0 },
  { name: 'David de Gracia', points: 0 },
];

/**
 * Puntos de la última lista de asistencia (sábado).
 * 'detail' guarda el desglose tal como está escrito en la hoja, para poder
 * auditar o corregir después desde la UI.
 */
const PUNTOS_SABADO = [
  { name: 'David Castillo', points: 125, detail: '10+10+5+100' },
  { name: 'Luis Rodriguez', points: 130, detail: '20+10+100' },
  { name: 'Justin Pimentel', points: 140, detail: '20+20+100' },
  { name: 'Bryan Martinez', points: 145, detail: '20+25+100' },
  { name: 'Eliath Davila', points: 120, detail: '25+20(I)+25+50' },
  { name: 'Jafeth Pimentel', points: 110, detail: '10+100' },
  { name: 'Jesseth Pimentel', points: 150, detail: '25+25+100' },
  { name: 'Cristopher Aguero', points: 50, detail: '50' },
  { name: 'Joseph Pimentel', points: 100, detail: '100' },
];

/** Fecha (YYYY-MM-DD) del sábado más reciente en o antes de hoy (hora local) */
const lastSaturday = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); // getDay(): 0=Dom ... 6=Sáb
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Resta días a una fecha YYYY-MM-DD */
const minusDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

const seedBibleClub = async () => {
  try {
    console.log('🔄 Sembrando Club Bíblico...');

    // sync() plano: solo crea las tablas nuevas, nunca altera columnas existentes
    await sequelize.sync();

    // ===== Iglesia destino =====
    // Solo id/name: si la BD local está atrasada respecto al modelo, evita
    // fallar por columnas que aún no existen (ej: churches.initials).
    const church = process.env.CHURCH_ID
      ? await Church.findByPk(parseInt(process.env.CHURCH_ID, 10), { attributes: ['id', 'name'] })
      : await Church.findOne({ attributes: ['id', 'name'], order: [['id', 'ASC']] });

    if (!church) {
      console.error('❌ No hay iglesias en la base de datos. Ejecuta primero: npm run seed');
      process.exit(1);
    }
    console.log(`   Iglesia: ${church.name} (id ${church.id})`);

    // Usuario al que se le atribuyen los movimientos (primer admin disponible)
    const admin = await User.findOne({ attributes: ['id'], order: [['id', 'ASC']] });

    const sabado = process.env.CLUB_DATE || lastSaturday();
    const fechaSaldos = minusDays(sabado, 1); // el saldo previo queda antes del sábado

    // ===== Grupo Salón A =====
    const [group, groupCreated] = await BibleClubGroup.findOrCreate({
      where: { church_id: church.id, name: 'Salón A' },
      defaults: {
        church_id: church.id,
        name: 'Salón A',
        description: 'Sección de adolescentes — Club Bíblico',
        is_active: true,
      },
    });
    console.log(`   Grupo "Salón A" ${groupCreated ? 'creado' : 'ya existía'} (id ${group.id})`);

    // ===== Participantes + saldo inicial + bono =====
    const byName = {};
    let nuevos = 0;

    for (const row of SALDOS_INICIALES) {
      const [student, created] = await BibleClubStudent.findOrCreate({
        where: { group_id: group.id, full_name: row.name },
        defaults: {
          church_id: church.id,
          group_id: group.id,
          full_name: row.name,
          is_active: true,
        },
      });
      byName[row.name] = student;
      if (created) nuevos += 1;

      // Saldo acumulado previo (solo si aún no se cargó)
      if (row.points > 0) {
        const [, txCreated] = await BibleClubTransaction.findOrCreate({
          where: { student_id: student.id, reason: 'Saldo acumulado', activity_date: fechaSaldos },
          defaults: {
            student_id: student.id,
            church_id: church.id,
            type: 'adjust',
            points: row.points,
            activity_date: fechaSaldos,
            reason: 'Saldo acumulado',
            notes: 'Carga inicial desde la hoja "Saldo por participante"',
            created_by: admin ? admin.id : null,
          },
        });
        if (!txCreated) {
          console.log(`   · ${row.name}: el saldo acumulado ya estaba cargado`);
        }
      }

      // Bono parejo de +30 (columna "+BONO")
      await BibleClubTransaction.findOrCreate({
        where: { student_id: student.id, reason: 'Bono', activity_date: fechaSaldos },
        defaults: {
          student_id: student.id,
          church_id: church.id,
          type: 'earn',
          points: BONO_INICIAL,
          activity_date: fechaSaldos,
          reason: 'Bono',
          notes: 'Bono incluido en la columna "+BONO" de la hoja de saldos',
          created_by: admin ? admin.id : null,
        },
      });
    }
    console.log(`   Participantes: ${SALDOS_INICIALES.length} (${nuevos} nuevos)`);

    // ===== Puntos del último sábado =====
    let registrados = 0;
    for (const row of PUNTOS_SABADO) {
      const student = byName[row.name];
      if (!student) {
        console.warn(`   ⚠️  Participante no encontrado: ${row.name}`);
        continue;
      }
      const [, created] = await BibleClubTransaction.findOrCreate({
        where: { student_id: student.id, activity_date: sabado, reason: 'Lista de asistencia' },
        defaults: {
          student_id: student.id,
          church_id: church.id,
          type: 'earn',
          points: row.points,
          activity_date: sabado,
          reason: 'Lista de asistencia',
          notes: `Desglose de la hoja: ${row.detail}`,
          created_by: admin ? admin.id : null,
        },
      });
      if (created) registrados += 1;
    }
    console.log(`   Puntos del sábado ${sabado}: ${registrados} movimiento(s) registrados`);

    console.log('');
    console.log('✅ Club Bíblico sembrado correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al sembrar el Club Bíblico:', error.message);
    process.exit(1);
  }
};

seedBibleClub();

/**
 * churchStats.js
 * 
 * Utilidades para recalcular automáticamente las estadísticas de la iglesia.
 * Todos estos valores se calculan desde los datos reales y NO se editan
 * manualmente en la web:
 * 
 * - faith_decisions_year: Desde EventAttendees con made_faith_decision = true
 * - avg_weekly_attendance: Promedio de WeeklyAttendance registros
 * - ordained_preachers, unordained_preachers: Desde Members con church_role
 * - ordained_deacons, unordained_deacons: Desde Members con church_role
 */

const { EventAttendee, Event, Member, WeeklyAttendance } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Recalcula el total de decisiones de fe de una iglesia para un año dado.
 * 
 * @param {Object} church - Instancia del modelo Church (Sequelize)
 * @param {number} [year] - Año a calcular. Por defecto el año actual.
 * @returns {number} Total de decisiones de fe calculadas
 */
async function recalculateChurchFaithDecisions(church, year) {
  try {
    const targetYear = year || new Date().getFullYear();
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    const totalFaithDecisions = await EventAttendee.count({
      where: { made_faith_decision: true },
      include: [{
        model: Event,
        as: 'event',
        attributes: [],
        where: {
          church_id: church.id,
          start_date: { [Op.between]: [startOfYear, endOfYear] },
        },
      }],
    });

    await church.update({
      faith_decisions_year: totalFaithDecisions || 0,
      faith_decisions_ref_year: targetYear,
    });

    console.log(`[STATS] Iglesia "${church.name}" (ID:${church.id}): ${totalFaithDecisions} decisiones de fe en ${targetYear}`);
    return totalFaithDecisions;
  } catch (error) {
    console.error(`[STATS ERROR] Error recalculando decisiones de fe para iglesia ${church.id}:`, error.message);
    throw error;
  }
}

/**
 * Recalcula el promedio de asistencia semanal de una iglesia.
 * 
 * Toma TODOS los registros de WeeklyAttendance de la iglesia,
 * calcula el promedio aritmético y lo guarda en avg_weekly_attendance.
 * 
 * @param {Object} church - Instancia del modelo Church (Sequelize)
 * @returns {number} Promedio calculado (redondeado a entero)
 */
async function recalculateAvgWeeklyAttendance(church) {
  try {
    // Calcular el promedio directamente con SQL para eficiencia
    const [result] = await sequelize.query(`
      SELECT 
        COALESCE(ROUND(AVG(attendance_count)), 0) as avg_attendance,
        COUNT(*) as total_weeks
      FROM weekly_attendances 
      WHERE church_id = :churchId
    `, {
      replacements: { churchId: church.id },
      type: sequelize.QueryTypes.SELECT,
    });

    const avg = parseInt(result.avg_attendance) || 0;

    await church.update({ avg_weekly_attendance: avg });

    console.log(`[STATS] Iglesia "${church.name}" (ID:${church.id}): Promedio asistencia semanal = ${avg} (${result.total_weeks} semanas)`);
    return avg;
  } catch (error) {
    console.error(`[STATS ERROR] Error recalculando asistencia promedio para iglesia ${church.id}:`, error.message);
    throw error;
  }
}

/**
 * Recalcula los contadores de cargos ministeriales de una iglesia.
 * 
 * Cuenta los miembros de la iglesia agrupados por church_role y actualiza:
 * - ordained_preachers:   Cantidad de 'Predicador Ordenado'
 * - unordained_preachers: Cantidad de 'Predicador No Ordenado'
 * - ordained_deacons:     Cantidad de 'Diácono Ordenado'
 * - unordained_deacons:   Cantidad de 'Diácono No Ordenado'
 * 
 * @param {Object} church - Instancia del modelo Church (Sequelize)
 * @returns {Object} Contadores { ordained_preachers, unordained_preachers, ordained_deacons, unordained_deacons }
 */
async function recalculateChurchRoleCounts(church) {
  try {
    // Consulta agrupada: una sola query para todos los contadores
    const counts = await Member.findAll({
      where: {
        church_id: church.id,
        church_role: { [Op.ne]: null },  // Solo miembros con cargo
      },
      attributes: [
        'church_role',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['church_role'],
      raw: true,
    });

    // Mapear resultados a un objeto para fácil acceso
    const roleMap = {};
    counts.forEach((row) => {
      roleMap[row.church_role] = parseInt(row.count) || 0;
    });

    const stats = {
      ordained_preachers: roleMap['Predicador Ordenado'] || 0,
      unordained_preachers: roleMap['Predicador No Ordenado'] || 0,
      ordained_deacons: roleMap['Diácono Ordenado'] || 0,
      unordained_deacons: roleMap['Diácono No Ordenado'] || 0,
    };

    await church.update(stats);

    console.log(`[STATS] Iglesia "${church.name}" (ID:${church.id}): Cargos = PO:${stats.ordained_preachers} PNO:${stats.unordained_preachers} DO:${stats.ordained_deacons} DNO:${stats.unordained_deacons}`);
    return stats;
  } catch (error) {
    console.error(`[STATS ERROR] Error recalculando cargos para iglesia ${church.id}:`, error.message);
    throw error;
  }
}

/**
 * Recalcula el total de miembros de una iglesia (membership_count).
 * 
 * Cuenta TODOS los miembros de la iglesia, sin importar tipo o cargo.
 * Se ejecuta automáticamente al crear, editar o eliminar miembros.
 * 
 * @param {Object} church - Instancia del modelo Church (Sequelize)
 * @returns {number} Total de miembros
 */
async function recalculateMembershipCount(church) {
  try {
    const total = await Member.count({
      where: { church_id: church.id },
    });

    await church.update({ membership_count: total });

    console.log(`[STATS] Iglesia "${church.name}" (ID:${church.id}): Membresía = ${total}`);
    return total;
  } catch (error) {
    console.error(`[STATS ERROR] Error recalculando membresía para iglesia ${church.id}:`, error.message);
    throw error;
  }
}

module.exports = {
  recalculateChurchFaithDecisions,
  recalculateAvgWeeklyAttendance,
  recalculateChurchRoleCounts,
  recalculateMembershipCount,
};

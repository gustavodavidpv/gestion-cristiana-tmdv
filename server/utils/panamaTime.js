/**
 * panamaTime.js - Utilidades de timezone para Panamá (UTC-5, sin DST)
 *
 * Panamá no observa horario de verano, así que UTC-5 es siempre correcto.
 * Estas funciones garantizan que las fechas se procesen en hora de Panamá
 * sin importar el timezone del servidor (Render corre en UTC).
 *
 * Técnica: Se crea un Date "shifteado" sumando el offset de Panamá al UTC,
 * y luego se leen los valores con getUTC*() (que siempre son estables).
 */

const PANAMA_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5 en milisegundos

/**
 * Retorna un Date cuyo getUTC*() devuelve los valores de hora Panamá.
 * IMPORTANTE: Este Date es "falso" — no usar getTime() para comparaciones.
 * Solo usar getUTCFullYear(), getUTCMonth(), getUTCDate(), getUTCHours(), getUTCMinutes().
 * @param {string|Date} isoStr - Fecha ISO (con Z) o Date object
 * @returns {Date} Date shifteado a hora Panamá
 */
function toPanamaDate(isoStr) {
  const d = new Date(isoStr);
  return new Date(d.getTime() + PANAMA_OFFSET_MS);
}

/**
 * Formatea hora como "HH:MM" en hora Panamá (24h).
 * @param {string|Date} date - Fecha/hora
 * @returns {string} Hora formateada "HH:MM"
 */
function formatTimePanama(date) {
  if (!date) return '';
  const d = toPanamaDate(date);
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

/**
 * Formatea fecha como "YYYY-MM-DD" en hora Panamá.
 * @param {string|Date} date - Fecha/hora
 * @returns {string} Fecha formateada "YYYY-MM-DD"
 */
function formatDatePanama(date) {
  if (!date) return '';
  const d = toPanamaDate(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

module.exports = { toPanamaDate, formatTimePanama, formatDatePanama, PANAMA_OFFSET_MS };

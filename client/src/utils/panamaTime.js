/**
 * panamaTime.js - Utilidades de timezone para Panamá (UTC-5, sin DST)
 *
 * Panamá no observa horario de verano, así que UTC-5 es siempre correcto.
 * Estas funciones garantizan que las fechas se muestren en hora de Panamá
 * sin importar el timezone del navegador del usuario.
 *
 * Técnica: Se crea un Date "shifteado" sumando el offset de Panamá al UTC,
 * y luego se leen los valores con getUTC*() (que siempre son estables).
 */

const PANAMA_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5 en milisegundos

/**
 * Retorna un Date cuyo getUTC*() devuelve los valores de hora Panamá.
 * IMPORTANTE: Este Date es "falso" — no usar getTime() para comparaciones.
 * Solo usar getUTCFullYear(), getUTCMonth(), getUTCDate(), getUTCHours(), getUTCMinutes().
 * @param {string|Date} isoStr - Fecha ISO del servidor (con Z) o Date object
 * @returns {Date} Date shifteado a hora Panamá
 */
export function toPanamaDate(isoStr) {
  const d = new Date(isoStr);
  return new Date(d.getTime() + PANAMA_OFFSET_MS);
}

/**
 * Convierte un ISO timestamp a formato "YYYY-MM-DDTHH:MM" en hora Panamá,
 * compatible con <input type="datetime-local">.
 * Ej: "2026-03-30T00:00:00.000Z" → "2026-03-29T19:00"
 * @param {string} isoStr - Fecha ISO del servidor
 * @returns {string} Formato "YYYY-MM-DDTHH:MM" en hora Panamá
 */
export function toPanamaDatetimeStr(isoStr) {
  if (!isoStr) return '';
  const d = toPanamaDate(isoStr);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/**
 * Formatea hora de un ISO timestamp como "HH:MM" en hora Panamá (24h).
 * @param {string|Date} date - Fecha/hora
 * @returns {string} Hora formateada "HH:MM"
 */
export function formatTimePanama(date) {
  if (!date) return '';
  const d = toPanamaDate(date);
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

/**
 * Formatea una fecha ISO con Intl.DateTimeFormat forzando timezone Panamá.
 * @param {string} isoStr - Fecha ISO
 * @param {Object} options - Opciones de Intl.DateTimeFormat (sin timeZone)
 * @returns {string} Fecha formateada en hora Panamá
 */
export function formatDatePanama(isoStr, options = {}) {
  if (!isoStr) return '-';
  return new Intl.DateTimeFormat('es-ES', {
    ...options,
    timeZone: 'America/Panama',
  }).format(new Date(isoStr));
}

/**
 * Agrega el sufijo "-05:00" a un string datetime-local naivo,
 * para que el backend lo interprete explícitamente como hora Panamá.
 * Si ya tiene timezone info (Z, +, -05:00), lo deja intacto.
 * @param {string} dateStr - Fecha del input datetime-local (ej: "2026-03-29T19:00")
 * @returns {string} Fecha con timezone explícito (ej: "2026-03-29T19:00-05:00")
 */
export function appendPanamaOffset(dateStr) {
  if (!dateStr) return dateStr;
  if (dateStr.includes('Z') || dateStr.includes('+') || dateStr.match(/-\d{2}:\d{2}$/)) {
    return dateStr;
  }
  return `${dateStr}-05:00`;
}

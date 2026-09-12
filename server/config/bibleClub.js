/**
 * bibleClub.js - Configuración del módulo Club Bíblico (adolescentes)
 *
 * Define los niveles por defecto (usados cuando un grupo no tiene niveles
 * personalizados) y los motivos de puntos sugeridos, tomados de la hoja
 * física de "Lista de Asistencia" del club.
 *
 * Los niveles se evalúan contra el TOTAL GANADO (puntos acumulados de por vida),
 * no contra el saldo — por eso la columna se llama "Nivel máximo": canjear
 * artículos baja el saldo pero nunca el nivel alcanzado.
 */

/** Niveles por defecto: min_points es el mínimo de puntos ganados para alcanzarlo */
const DEFAULT_LEVELS = [
  { name: 'Nivel 1', min_points: 0, color: '#90A4AE' },
  { name: 'Nivel 2', min_points: 50, color: '#26A69A' },
  { name: 'Nivel 3', min_points: 65, color: '#1E88E5' },
  { name: 'Premium', min_points: 300, color: '#F9A825' },
];

/** Motivos sugeridos para otorgar puntos (columnas de la hoja de asistencia) */
const POINT_REASONS = [
  'Por llevar Biblia',
  'Por llegar temprano',
  'Por traer invitados',
  'Versículo memorizado',
  'Participación en clase',
  'Bono',
  'Otro',
];

/** Tipos de movimiento de puntos */
const TRANSACTION_TYPES = ['earn', 'redeem', 'adjust'];

/**
 * Normaliza una lista de niveles: descarta entradas inválidas y ordena
 * de menor a mayor min_points.
 * @param {Array|null} levels
 * @returns {Array} niveles válidos y ordenados (o los por defecto)
 */
const normalizeLevels = (levels) => {
  if (!Array.isArray(levels) || levels.length === 0) return DEFAULT_LEVELS;
  const clean = levels
    .filter((l) => l && typeof l.name === 'string' && l.name.trim())
    .map((l) => ({
      name: l.name.trim(),
      min_points: Number.isFinite(Number(l.min_points)) ? Number(l.min_points) : 0,
      color: l.color || '#90A4AE',
    }))
    .sort((a, b) => a.min_points - b.min_points);
  return clean.length ? clean : DEFAULT_LEVELS;
};

/**
 * Calcula el nivel alcanzado con una cantidad de puntos ganados.
 * @param {number} earnedPoints - Total de puntos ganados (no el saldo)
 * @param {Array|null} levels - Niveles del grupo (usa DEFAULT_LEVELS si no hay)
 * @returns {{name: string, min_points: number, color: string}|null}
 */
const computeLevel = (earnedPoints, levels) => {
  const list = normalizeLevels(levels);
  let current = null;
  for (const level of list) {
    if (earnedPoints >= level.min_points) current = level;
  }
  return current || list[0] || null;
};

module.exports = { DEFAULT_LEVELS, POINT_REASONS, TRANSACTION_TYPES, normalizeLevels, computeLevel };

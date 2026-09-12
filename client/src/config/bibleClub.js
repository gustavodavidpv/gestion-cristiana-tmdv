/**
 * bibleClub.js - Constantes del Club Bíblico para el frontend
 *
 * Espejo de server/config/bibleClub.js. El backend ya devuelve el nivel
 * calculado de cada participante; estas constantes se usan para los
 * formularios (motivos sugeridos y editor de niveles).
 */

/** Niveles por defecto cuando un grupo no tiene niveles personalizados */
export const DEFAULT_LEVELS = [
  { name: 'Nivel 1', min_points: 0, color: '#90A4AE' },
  { name: 'Nivel 2', min_points: 50, color: '#26A69A' },
  { name: 'Nivel 3', min_points: 65, color: '#1E88E5' },
  { name: 'Premium', min_points: 300, color: '#F9A825' },
];

/** Motivos sugeridos (columnas de la hoja física de asistencia) */
export const POINT_REASONS = [
  'Lista de asistencia',
  'Por llevar Biblia',
  'Por llegar temprano',
  'Por traer invitados',
  'Versículo memorizado',
  'Participación en clase',
  'Bono',
  'Otro',
];

/** Atajos de puntos que se usan con más frecuencia en la hoja */
export const QUICK_POINTS = [5, 10, 20, 25, 50, 100];

/** Etiquetas de los tipos de movimiento */
export const TYPE_LABELS = {
  earn: 'Puntos ganados',
  redeem: 'Canje',
  adjust: 'Ajuste',
};

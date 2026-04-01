/**
 * permissions.js - Constantes de permisos para el frontend
 *
 * Espejo de server/config/permissions.js para uso en la UI.
 * Define módulos, labels de acciones y mapeo de módulos a rutas.
 */

/** Módulos del sistema con sus acciones disponibles */
export const MODULES = [
  { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { key: 'members', label: 'Miembros', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'churches', label: 'Iglesias', actions: ['view', 'edit', 'delete'] },
  { key: 'events', label: 'Eventos', actions: ['view', 'create', 'edit', 'delete', 'attendance'] },
  { key: 'weekly_attendance', label: 'Asistencia Semanal', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'minutes', label: 'Actas', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'notifications', label: 'Notificaciones', actions: ['view', 'edit'] },
  { key: 'positions', label: 'Cargos Ministeriales', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'branding', label: 'Branding', actions: ['view', 'edit', 'delete'] },
  { key: 'users', label: 'Usuarios', actions: ['view', 'create', 'edit', 'delete'] },
];

/** Labels en español para las acciones */
export const ACTION_LABELS = {
  view: 'Ver',
  create: 'Crear',
  edit: 'Editar',
  delete: 'Eliminar',
  attendance: 'Asistencia',
};

/** Todas las acciones posibles (para columnas de la tabla) */
export const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'attendance'];

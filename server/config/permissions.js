/**
 * permissions.js - Configuración centralizada de permisos por módulo y rol
 *
 * Define los módulos del sistema, las acciones disponibles por módulo,
 * y los permisos por defecto para cada rol (que coinciden con el
 * comportamiento hardcodeado original antes de implementar permisos dinámicos).
 *
 * SuperAdmin NO se incluye en DEFAULTS — siempre tiene acceso total (bypass).
 */

/**
 * Módulos del sistema con sus acciones disponibles.
 * 'key' se usa en la DB y en el middleware.
 * 'label' es el nombre en español para la UI.
 * 'actions' lista las acciones válidas para ese módulo.
 */
const MODULES = [
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

/** Labels en español para las acciones (usados en la UI de permisos) */
const ACTION_LABELS = {
  view: 'Ver',
  create: 'Crear',
  edit: 'Editar',
  delete: 'Eliminar',
  attendance: 'Asistencia',
};

/** Todas las acciones posibles en el sistema */
const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'attendance'];

/**
 * Permisos por defecto para cada rol (excepto SuperAdmin).
 * Coinciden exactamente con el comportamiento hardcodeado original
 * en los archivos de rutas y componentes frontend.
 *
 * Estructura: { [roleName]: { [moduleKey]: { [action]: boolean } } }
 */
const DEFAULTS = {
  Administrador: {
    dashboard: { view: true },
    members: { view: true, create: true, edit: true, delete: true },
    churches: { view: true, edit: true, delete: true },
    events: { view: true, create: true, edit: true, delete: true, attendance: true },
    weekly_attendance: { view: true, create: true, edit: true, delete: true },
    minutes: { view: true, create: true, edit: true, delete: true },
    notifications: { view: true, edit: true },
    positions: { view: true, create: true, edit: true, delete: true },
    branding: { view: true, edit: true, delete: true },
    users: { view: true, create: true, edit: true, delete: true },
  },
  'Secretaría': {
    dashboard: { view: true },
    members: { view: true, create: true, edit: true, delete: false },
    churches: { view: true, edit: true, delete: false },
    events: { view: true, create: true, edit: true, delete: false, attendance: true },
    weekly_attendance: { view: true, create: true, edit: true, delete: false },
    minutes: { view: true, create: true, edit: true, delete: false },
    notifications: { view: true, edit: true },
    positions: { view: false, create: false, edit: false, delete: false },
    branding: { view: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
  },
  'Líder': {
    dashboard: { view: true },
    members: { view: true, create: true, edit: true, delete: false },
    churches: { view: false, edit: false, delete: false },
    events: { view: true, create: true, edit: true, delete: false, attendance: true },
    weekly_attendance: { view: true, create: true, edit: false, delete: false },
    minutes: { view: false, create: false, edit: false, delete: false },
    notifications: { view: false, edit: false },
    positions: { view: false, create: false, edit: false, delete: false },
    branding: { view: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
  },
  Asistencia: {
    dashboard: { view: true },
    members: { view: true, create: false, edit: false, delete: false },
    churches: { view: false, edit: false, delete: false },
    events: { view: true, create: false, edit: false, delete: false, attendance: true },
    weekly_attendance: { view: true, create: true, edit: false, delete: false },
    minutes: { view: false, create: false, edit: false, delete: false },
    notifications: { view: false, edit: false },
    positions: { view: false, create: false, edit: false, delete: false },
    branding: { view: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
  },
  Visitante: {
    dashboard: { view: true },
    members: { view: true, create: false, edit: false, delete: false },
    churches: { view: false, edit: false, delete: false },
    events: { view: false, create: false, edit: false, delete: false, attendance: false },
    weekly_attendance: { view: false, create: false, edit: false, delete: false },
    minutes: { view: false, create: false, edit: false, delete: false },
    notifications: { view: false, edit: false },
    positions: { view: false, create: false, edit: false, delete: false },
    branding: { view: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
  },
};

module.exports = { MODULES, ACTION_LABELS, ALL_ACTIONS, DEFAULTS };

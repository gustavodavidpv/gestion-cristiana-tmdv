/// Copia de `server/config/permissions.js` (MODULES + DEFAULTS).
/// Si el servidor cambia sus permisos por defecto, actualizar aquí también.
const serverModules = <String, List<String>>{
  'dashboard': ['view'],
  'members': ['view', 'create', 'edit', 'delete'],
  'churches': ['view', 'edit', 'delete'],
  'events': ['view', 'create', 'edit', 'delete', 'attendance'],
  'weekly_attendance': ['view', 'create', 'edit', 'delete'],
  'minutes': ['view', 'create', 'edit', 'delete'],
  'bible_club': ['view', 'create', 'edit', 'delete'],
  'notifications': ['view', 'edit'],
  'positions': ['view', 'create', 'edit', 'delete'],
  'branding': ['view', 'edit', 'delete'],
  'users': ['view', 'create', 'edit', 'delete'],
};

const _t = true;
const _f = false;

const serverDefaults = <String, Map<String, Map<String, bool>>>{
  'Administrador': {
    'dashboard': {'view': _t},
    'members': {'view': _t, 'create': _t, 'edit': _t, 'delete': _t},
    'churches': {'view': _t, 'edit': _t, 'delete': _t},
    'events': {'view': _t, 'create': _t, 'edit': _t, 'delete': _t, 'attendance': _t},
    'weekly_attendance': {'view': _t, 'create': _t, 'edit': _t, 'delete': _t},
    'minutes': {'view': _t, 'create': _t, 'edit': _t, 'delete': _t},
    'bible_club': {'view': _t, 'create': _t, 'edit': _t, 'delete': _t},
    'notifications': {'view': _t, 'edit': _t},
    'positions': {'view': _t, 'create': _t, 'edit': _t, 'delete': _t},
    'branding': {'view': _t, 'edit': _t, 'delete': _t},
    'users': {'view': _t, 'create': _t, 'edit': _t, 'delete': _t},
  },
  'Secretaría': {
    'dashboard': {'view': _t},
    'members': {'view': _t, 'create': _t, 'edit': _t, 'delete': _f},
    'churches': {'view': _t, 'edit': _t, 'delete': _f},
    'events': {'view': _t, 'create': _t, 'edit': _t, 'delete': _f, 'attendance': _t},
    'weekly_attendance': {'view': _t, 'create': _t, 'edit': _t, 'delete': _f},
    'minutes': {'view': _t, 'create': _t, 'edit': _t, 'delete': _f},
    'bible_club': {'view': _t, 'create': _t, 'edit': _t, 'delete': _f},
    'notifications': {'view': _t, 'edit': _t},
    'positions': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
    'branding': {'view': _f, 'edit': _f, 'delete': _f},
    'users': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
  },
  'Líder': {
    'dashboard': {'view': _t},
    'members': {'view': _t, 'create': _t, 'edit': _t, 'delete': _f},
    'churches': {'view': _f, 'edit': _f, 'delete': _f},
    'events': {'view': _t, 'create': _t, 'edit': _t, 'delete': _f, 'attendance': _t},
    'weekly_attendance': {'view': _t, 'create': _t, 'edit': _f, 'delete': _f},
    'minutes': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
    'bible_club': {'view': _t, 'create': _t, 'edit': _t, 'delete': _f},
    'notifications': {'view': _f, 'edit': _f},
    'positions': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
    'branding': {'view': _f, 'edit': _f, 'delete': _f},
    'users': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
  },
  'Asistencia': {
    'dashboard': {'view': _t},
    'members': {'view': _t, 'create': _f, 'edit': _f, 'delete': _f},
    'churches': {'view': _f, 'edit': _f, 'delete': _f},
    'events': {'view': _t, 'create': _f, 'edit': _f, 'delete': _f, 'attendance': _t},
    'weekly_attendance': {'view': _t, 'create': _t, 'edit': _f, 'delete': _f},
    'minutes': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
    'bible_club': {'view': _t, 'create': _t, 'edit': _f, 'delete': _f},
    'notifications': {'view': _f, 'edit': _f},
    'positions': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
    'branding': {'view': _f, 'edit': _f, 'delete': _f},
    'users': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
  },
  'Visitante': {
    'dashboard': {'view': _t},
    'members': {'view': _t, 'create': _f, 'edit': _f, 'delete': _f},
    'churches': {'view': _f, 'edit': _f, 'delete': _f},
    'events': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f, 'attendance': _f},
    'weekly_attendance': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
    'minutes': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
    'bible_club': {'view': _t, 'create': _f, 'edit': _f, 'delete': _f},
    'notifications': {'view': _f, 'edit': _f},
    'positions': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
    'branding': {'view': _f, 'edit': _f, 'delete': _f},
    'users': {'view': _f, 'create': _f, 'edit': _f, 'delete': _f},
  },
};

/// Igual que `authController.getMyPermissions`: SuperAdmin tiene todo.
Map<String, Map<String, bool>> permissionsFor(String role) {
  if (role == 'SuperAdmin') {
    return {for (final e in serverModules.entries) e.key: {for (final a in e.value) a: true}};
  }
  final d = serverDefaults[role] ?? const {};
  return {
    for (final e in serverModules.entries) e.key: {for (final a in e.value) a: d[e.key]?[a] ?? false},
  };
}

const allRoles = ['SuperAdmin', 'Administrador', 'Secretaría', 'Líder', 'Asistencia', 'Visitante'];

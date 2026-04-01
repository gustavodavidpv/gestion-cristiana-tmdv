const SYSTEM_ROLES = [
  {
    name: 'SuperAdmin',
    description: 'Acceso total al sistema sin restriccion de iglesia (cross-tenant)',
  },
  {
    name: 'Administrador',
    description: 'Acceso total dentro de su iglesia (single-tenant)',
  },
  {
    name: 'Secretaría',
    description: 'Puede ver y alimentar datos de la iglesia',
  },
  {
    name: 'Líder',
    description: 'Puede crear eventos y registrar asistencia',
  },
  {
    name: 'Asistencia',
    description: 'Puede registrar asistencia en eventos y ver miembros',
  },
  {
    name: 'Visitante',
    description: 'Solo puede ver informacion basica',
  },
];

const SYSTEM_ROLE_NAMES = SYSTEM_ROLES.map((role) => role.name);

const PROTECTED_ROLE_NAMES = [...SYSTEM_ROLE_NAMES];

module.exports = {
  SYSTEM_ROLES,
  SYSTEM_ROLE_NAMES,
  PROTECTED_ROLE_NAMES,
};

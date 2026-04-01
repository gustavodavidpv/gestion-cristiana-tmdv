const { Op } = require('sequelize');
const { Role, RolePermission } = require('../models');
const { MODULES, DEFAULTS } = require('../config/permissions');
const { SYSTEM_ROLES } = require('../config/roles');

const buildPermissionRows = (roleId, defaults = {}) => (
  MODULES.flatMap((module) =>
    module.actions.map((action) => ({
      role_id: roleId,
      module: module.key,
      action,
      allowed: defaults[module.key]?.[action] ?? false,
    }))
  )
);

const ensureSystemRoles = async (options = {}) => {
  const { transaction } = options;
  const roles = [];

  for (const roleData of SYSTEM_ROLES) {
    const [role] = await Role.findOrCreate({
      where: { name: roleData.name },
      defaults: roleData,
      transaction,
    });
    roles.push(role);
  }

  return roles;
};

const initializeRolePermissionsForRole = async (role, options = {}) => {
  const { transaction } = options;
  const defaults = DEFAULTS[role.name] || {};
  const rows = buildPermissionRows(role.id, defaults);

  if (!rows.length) return;

  await RolePermission.bulkCreate(rows, {
    ignoreDuplicates: true,
    transaction,
  });
};

const ensureDefaultRolePermissions = async (options = {}) => {
  const { transaction } = options;
  const roles = await Role.findAll({
    where: { name: { [Op.ne]: 'SuperAdmin' } },
    transaction,
  });

  for (const role of roles) {
    await initializeRolePermissionsForRole(role, { transaction });
  }
};

module.exports = {
  ensureSystemRoles,
  ensureDefaultRolePermissions,
  initializeRolePermissionsForRole,
};

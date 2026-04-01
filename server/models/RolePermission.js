/**
 * RolePermission.js - Modelo de permisos dinámicos por rol
 *
 * Cada fila representa un permiso específico:
 *   role_id + module + action → allowed (true/false)
 *
 * SuperAdmin NO tiene filas aquí — siempre tiene acceso total (bypass en middleware).
 * Si un rol no tiene filas, se usan los DEFAULTS de server/config/permissions.js.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { MODULES, ALL_ACTIONS } = require('../config/permissions');

/** Claves válidas de módulo (para validación) */
const validModules = MODULES.map((m) => m.key);

const RolePermission = sequelize.define('RolePermission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'roles', key: 'id' },
    onDelete: 'CASCADE',
    comment: 'FK al rol (no incluye SuperAdmin)',
  },
  module: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: {
        args: [validModules],
        msg: `Módulo debe ser uno de: ${validModules.join(', ')}`,
      },
    },
    comment: 'Clave del módulo (ej: members, events)',
  },
  action: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      isIn: {
        args: [ALL_ACTIONS],
        msg: `Acción debe ser una de: ${ALL_ACTIONS.join(', ')}`,
      },
    },
    comment: 'Acción (view, create, edit, delete, attendance)',
  },
  allowed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Si el permiso está habilitado o no',
  },
}, {
  tableName: 'role_permissions',
  indexes: [
    {
      unique: true,
      fields: ['role_id', 'module', 'action'],
      name: 'unique_role_module_action',
    },
  ],
});

module.exports = RolePermission;

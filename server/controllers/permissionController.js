/**
 * permissionController.js - Gestión de permisos CRUD por rol
 *
 * Solo accesible por SuperAdmin.
 * Endpoints:
 *   GET  /api/permissions   — Obtener la matriz completa de permisos
 *   PUT  /api/permissions   — Actualizar permisos en bloque
 */
const { RolePermission, Role, sequelize } = require('../models');
const { MODULES, DEFAULTS } = require('../config/permissions');

const permissionController = {
  /**
   * GET /api/permissions
   * Retorna la matriz completa de permisos para la UI de gestión.
   * Estructura: { roles: [...], modules: MODULES, permissions: { [roleId]: { [module]: { [action]: bool } } } }
   */
  async getAll(req, res) {
    try {
      // Obtener todos los roles excepto SuperAdmin (no se gestionan sus permisos)
      const roles = await Role.findAll({
        where: { name: { [require('sequelize').Op.ne]: 'SuperAdmin' } },
        attributes: ['id', 'name'],
        order: [['id', 'ASC']],
      });

      // Obtener todos los permisos de la tabla
      const allPerms = await RolePermission.findAll({
        attributes: ['role_id', 'module', 'action', 'allowed'],
        raw: true,
      });

      // Construir la matriz de permisos por roleId
      const permissions = {};
      for (const role of roles) {
        permissions[role.id] = {};
        const roleDefaults = DEFAULTS[role.name] || {};

        for (const mod of MODULES) {
          permissions[role.id][mod.key] = {};
          for (const action of mod.actions) {
            // Buscar permiso en DB, fallback a default
            const dbPerm = allPerms.find(
              (p) => p.role_id === role.id && p.module === mod.key && p.action === action
            );
            permissions[role.id][mod.key][action] = dbPerm
              ? dbPerm.allowed
              : (roleDefaults[mod.key]?.[action] ?? false);
          }
        }
      }

      res.json({ roles, modules: MODULES, permissions });
    } catch (error) {
      console.error('Error al obtener permisos:', error);
      res.status(500).json({ message: 'Error al obtener permisos.', error: error.message });
    }
  },

  /**
   * PUT /api/permissions
   * Actualiza permisos en bloque.
   * Body: { permissions: { [roleId]: { [module]: { [action]: bool } } } }
   * Usa UPSERT (INSERT ... ON CONFLICT DO UPDATE) dentro de una transacción.
   */
  async updateAll(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { permissions } = req.body;
      if (!permissions || typeof permissions !== 'object') {
        await transaction.rollback();
        return res.status(400).json({ message: 'Se requiere el campo permissions.' });
      }

      // Validar que los módulos y acciones sean válidos
      const validModules = new Set(MODULES.map((m) => m.key));
      const validActionsByModule = {};
      for (const mod of MODULES) {
        validActionsByModule[mod.key] = new Set(mod.actions);
      }

      let updated = 0;

      for (const [roleId, modules] of Object.entries(permissions)) {
        const roleIdInt = parseInt(roleId, 10);
        if (isNaN(roleIdInt)) continue;

        for (const [moduleKey, actions] of Object.entries(modules)) {
          if (!validModules.has(moduleKey)) continue;

          for (const [action, allowed] of Object.entries(actions)) {
            if (!validActionsByModule[moduleKey]?.has(action)) continue;

            // UPSERT: crear o actualizar el permiso
            await sequelize.query(
              `INSERT INTO role_permissions (role_id, module, action, allowed, created_at, updated_at)
               VALUES ($1, $2, $3, $4, NOW(), NOW())
               ON CONFLICT (role_id, module, action)
               DO UPDATE SET allowed = $4, updated_at = NOW()`,
              { bind: [roleIdInt, moduleKey, action, !!allowed], transaction }
            );
            updated++;
          }
        }
      }

      await transaction.commit();
      res.json({ message: 'Permisos actualizados correctamente.', updated });
    } catch (error) {
      await transaction.rollback();
      console.error('Error al actualizar permisos:', error);
      res.status(500).json({ message: 'Error al actualizar permisos.', error: error.message });
    }
  },
};

module.exports = permissionController;

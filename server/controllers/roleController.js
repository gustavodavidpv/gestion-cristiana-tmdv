const { Op, fn, col, where } = require('sequelize');
const { sequelize, Role, User } = require('../models');
const { PROTECTED_ROLE_NAMES } = require('../config/roles');
const { initializeRolePermissionsForRole } = require('../utils/roleSetup');

const normalizeName = (value) => (typeof value === 'string' ? value.trim() : '');

const findRoleByNameInsensitive = (name, excludeId = null, transaction = null) => {
  const conditions = [
    where(fn('LOWER', col('name')), normalizeName(name).toLowerCase()),
  ];

  if (excludeId) {
    conditions.push({ id: { [Op.ne]: excludeId } });
  }

  return Role.findOne({
    where: { [Op.and]: conditions },
    transaction,
  });
};

const serializeRole = async (role) => {
  const userCount = await User.count({ where: { role_id: role.id } });

  return {
    ...role.toJSON(),
    is_system: PROTECTED_ROLE_NAMES.includes(role.name),
    users_count: userCount,
  };
};

const roleController = {
  async getAll(req, res) {
    try {
      const roles = await Role.findAll({
        order: [['name', 'ASC']],
      });

      const payload = await Promise.all(roles.map((role) => serializeRole(role)));
      res.json({ roles: payload });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener roles.', error: error.message });
    }
  },

  async create(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const name = normalizeName(req.body.name);
      const description = typeof req.body.description === 'string' ? req.body.description.trim() : null;

      if (!name) {
        await transaction.rollback();
        return res.status(400).json({ message: 'El nombre del rol es requerido.' });
      }

      const existingRole = await findRoleByNameInsensitive(name, null, transaction);
      if (existingRole) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Ya existe un rol con ese nombre.' });
      }

      const role = await Role.create({
        name,
        description,
      }, { transaction });

      await initializeRolePermissionsForRole(role, { transaction });
      await transaction.commit();

      res.status(201).json({
        message: 'Rol creado exitosamente.',
        role: await serializeRole(role),
      });
    } catch (error) {
      await transaction.rollback();
      res.status(500).json({ message: 'Error al crear rol.', error: error.message });
    }
  },

  async update(req, res) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) {
        return res.status(404).json({ message: 'Rol no encontrado.' });
      }

      if (PROTECTED_ROLE_NAMES.includes(role.name)) {
        return res.status(403).json({ message: 'Los roles del sistema no se pueden editar desde este modulo.' });
      }

      const name = normalizeName(req.body.name);
      const description = typeof req.body.description === 'string' ? req.body.description.trim() : null;

      if (!name) {
        return res.status(400).json({ message: 'El nombre del rol es requerido.' });
      }

      const existingRole = await findRoleByNameInsensitive(name, role.id);
      if (existingRole) {
        return res.status(400).json({ message: 'Ya existe un rol con ese nombre.' });
      }

      await role.update({
        name,
        description,
      });

      res.json({
        message: 'Rol actualizado exitosamente.',
        role: await serializeRole(role),
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar rol.', error: error.message });
    }
  },

  async delete(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const role = await Role.findByPk(req.params.id, { transaction });
      if (!role) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Rol no encontrado.' });
      }

      if (PROTECTED_ROLE_NAMES.includes(role.name)) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Los roles del sistema no se pueden eliminar.' });
      }

      const usersCount = await User.count({
        where: { role_id: role.id },
        transaction,
      });

      if (usersCount > 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'No se puede eliminar un rol que todavia tiene usuarios asignados.',
        });
      }

      await role.destroy({ transaction });
      await transaction.commit();

      res.json({ message: 'Rol eliminado exitosamente.' });
    } catch (error) {
      await transaction.rollback();
      res.status(500).json({ message: 'Error al eliminar rol.', error: error.message });
    }
  },
};

module.exports = roleController;

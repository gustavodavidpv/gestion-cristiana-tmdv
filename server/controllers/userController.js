const { User, Role, Church } = require('../models');
const { Op } = require('sequelize');

const userController = {
  // GET /api/users
  async getAll(req, res) {
    try {
      const { search, role_id, is_active, page = 1, limit = 20 } = req.query;

      const where = {};
      if (search) {
        where[Op.or] = [
          { full_name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ];
      }
      if (role_id) where.role_id = role_id;
      if (is_active !== undefined) where.is_active = is_active === 'true';

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows: users, count: total } = await User.findAndCountAll({
        where,
        include: [
          { model: Role, as: 'role', attributes: ['id', 'name'] },
          { model: Church, as: 'church', attributes: ['id', 'name'] },
        ],
        attributes: { exclude: ['password_hash'] },
        order: [['full_name', 'ASC']],
        limit: parseInt(limit),
        offset,
      });

      res.json({
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener usuarios.', error: error.message });
    }
  },

  // GET /api/users/:id
  async getById(req, res) {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [
          { model: Role, as: 'role' },
          { model: Church, as: 'church' },
        ],
        attributes: { exclude: ['password_hash'] },
      });

      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado.' });
      }

      res.json({ user });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener usuario.', error: error.message });
    }
  },

  // POST /api/users
  async create(req, res) {
    try {
      const { email, password, full_name, role_id, church_id } = req.body;

      if (!email || !password || !full_name || !role_id) {
        return res.status(400).json({ message: 'Email, contraseña, nombre completo y rol son requeridos.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
      }

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: 'El email ya está registrado.' });
      }

      const role = await Role.findByPk(role_id);
      if (!role) {
        return res.status(400).json({ message: 'Rol no válido.' });
      }

      const user = await User.create({
        email,
        password_hash: password,
        full_name,
        role_id,
        church_id: church_id || null,
      });

      const createdUser = await User.findByPk(user.id, {
        include: [
          { model: Role, as: 'role', attributes: ['id', 'name'] },
          { model: Church, as: 'church', attributes: ['id', 'name'] },
        ],
        attributes: { exclude: ['password_hash'] },
      });

      res.status(201).json({ message: 'Usuario creado exitosamente.', user: createdUser });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear usuario.', error: error.message });
    }
  },

  // PUT /api/users/:id
  async update(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado.' });
      }

      const { email, full_name, role_id, church_id, is_active } = req.body;

      // Si cambia el email, verificar que no exista
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
          return res.status(400).json({ message: 'El email ya está en uso por otro usuario.' });
        }
      }

      await user.update({
        email: email || user.email,
        full_name: full_name || user.full_name,
        role_id: role_id || user.role_id,
        church_id: church_id !== undefined ? church_id : user.church_id,
        is_active: is_active !== undefined ? is_active : user.is_active,
      });

      const updatedUser = await User.findByPk(user.id, {
        include: [
          { model: Role, as: 'role', attributes: ['id', 'name'] },
          { model: Church, as: 'church', attributes: ['id', 'name'] },
        ],
        attributes: { exclude: ['password_hash'] },
      });

      res.json({ message: 'Usuario actualizado exitosamente.', user: updatedUser });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar usuario.', error: error.message });
    }
  },

  // DELETE /api/users/:id
  async delete(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado.' });
      }

      // No permitir eliminar al propio usuario
      if (user.id === req.user.id) {
        return res.status(400).json({ message: 'No puede eliminarse a sí mismo.' });
      }

      await user.destroy();
      res.json({ message: 'Usuario eliminado exitosamente.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar usuario.', error: error.message });
    }
  },

  // GET /api/users/roles/all
  async getRoles(req, res) {
    try {
      const roles = await Role.findAll({ order: [['id', 'ASC']] });
      res.json({ roles });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener roles.', error: error.message });
    }
  },
};

module.exports = userController;

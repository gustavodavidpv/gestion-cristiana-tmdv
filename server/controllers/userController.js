const { User, Role, Church } = require('../models');
const { Op } = require('sequelize');
const { isSuperAdmin } = require('../middleware/auth');

const userController = {
  // GET /api/users
  // SuperAdmin: ve todos. Admin: solo usuarios de su iglesia.
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

      // Admin solo ve usuarios de su iglesia
      if (!isSuperAdmin(req.user) && req.user.church_id) {
        where.church_id = req.user.church_id;
      }

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

      // Admin solo puede ver usuarios de su iglesia
      if (!isSuperAdmin(req.user) && req.user.church_id !== user.church_id) {
        return res.status(403).json({ message: 'No tienes acceso a este usuario.' });
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

      // Admin no puede crear SuperAdmins
      if (!isSuperAdmin(req.user) && role.name === 'SuperAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para crear usuarios SuperAdmin.' });
      }

      // Admin solo puede crear usuarios para su iglesia
      const targetChurchId = isSuperAdmin(req.user)
        ? (church_id || null)
        : req.user.church_id;

      const user = await User.create({
        email,
        password_hash: password,
        full_name,
        role_id,
        church_id: targetChurchId,
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

      // Admin solo puede editar usuarios de su iglesia
      if (!isSuperAdmin(req.user) && req.user.church_id !== user.church_id) {
        return res.status(403).json({ message: 'No tienes acceso a este usuario.' });
      }

      const { email, full_name, role_id, church_id, is_active } = req.body;

      // Verificar email único
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
          return res.status(400).json({ message: 'El email ya está en uso por otro usuario.' });
        }
      }

      // Admin no puede cambiar church_id (solo SuperAdmin)
      const newChurchId = isSuperAdmin(req.user)
        ? (church_id !== undefined ? church_id : user.church_id)
        : user.church_id;

      await user.update({
        email: email || user.email,
        full_name: full_name || user.full_name,
        role_id: role_id || user.role_id,
        church_id: newChurchId,
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

      // Admin no puede eliminar usuarios de otra iglesia
      if (!isSuperAdmin(req.user) && req.user.church_id !== user.church_id) {
        return res.status(403).json({ message: 'No tienes acceso a este usuario.' });
      }

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
      const where = {};
      // Admin no ve SuperAdmin en la lista de roles
      if (!isSuperAdmin(req.user)) {
        where.name = { [Op.ne]: 'SuperAdmin' };
      }
      const roles = await Role.findAll({ where, order: [['id', 'ASC']] });
      res.json({ roles });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener roles.', error: error.message });
    }
  },
};

module.exports = userController;

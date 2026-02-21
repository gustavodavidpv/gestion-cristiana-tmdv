const { Member, Church } = require('../models');
const { Op } = require('sequelize');
const { recalculateChurchRoleCounts, recalculateMembershipCount } = require('../utils/churchStats');

const memberController = {
  // GET /api/members?church_id=X&search=Y&member_type=Z&church_role=W
  async getAll(req, res) {
    try {
      const { church_id, member_type, church_role, baptized, search, page = 1, limit = 20 } = req.query;

      const where = {};
      if (church_id) where.church_id = church_id;
      if (member_type) where.member_type = member_type;
      // Filtro por cargo ministerial
      if (church_role) where.church_role = church_role;
      if (baptized !== undefined) where.baptized = baptized === 'true';
      if (search) {
        where[Op.or] = [
          { first_name: { [Op.iLike]: `%${search}%` } },
          { last_name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ];
      }

      // Si no es admin, filtrar por su iglesia
      if (req.user.role.name !== 'Administrador' && req.user.church_id) {
        where.church_id = req.user.church_id;
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows: members, count: total } = await Member.findAndCountAll({
        where,
        include: [{ model: Church, as: 'church', attributes: ['id', 'name'] }],
        order: [['last_name', 'ASC'], ['first_name', 'ASC']],
        limit: parseInt(limit),
        offset,
      });

      res.json({
        members,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener miembros.', error: error.message });
    }
  },

  // GET /api/members/:id
  async getById(req, res) {
    try {
      const member = await Member.findByPk(req.params.id, {
        include: [{ model: Church, as: 'church', attributes: ['id', 'name'] }],
      });

      if (!member) {
        return res.status(404).json({ message: 'Miembro no encontrado.' });
      }

      res.json({ member });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener miembro.', error: error.message });
    }
  },

  /**
   * POST /api/members
   * Crear un nuevo miembro.
   * Recalcula: membership_count siempre, church_role counts si tiene cargo.
   */
  async create(req, res) {
    try {
      const {
        church_id, first_name, last_name, age, sex, birth_date,
        baptized, member_type, church_role, phone, email, address,
      } = req.body;

      const member = await Member.create({
        church_id: church_id || req.user.church_id,
        first_name,
        last_name,
        age,
        sex,
        birth_date: birth_date || null,
        baptized,
        member_type,
        church_role: church_role || null, // Normalizar vacío a null
        phone,
        email,
        address,
      });

      // Recalcular estadísticas de la iglesia
      try {
        const church = await Church.findByPk(member.church_id);
        if (church) {
          // Siempre recalcular membresía al crear
          await recalculateMembershipCount(church);
          // Recalcular cargos si el miembro tiene cargo
          if (member.church_role) {
            await recalculateChurchRoleCounts(church);
          }
        }
      } catch (statsErr) {
        console.error('[STATS] Error recalculando stats:', statsErr.message);
      }

      res.status(201).json({ message: 'Miembro creado exitosamente.', member });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear miembro.', error: error.message });
    }
  },

  /**
   * PUT /api/members/:id
   * Actualizar miembro. Si cambió church_role, recalcular contadores
   * (puede afectar iglesia anterior y/o nueva si cambió de iglesia).
   */
  async update(req, res) {
    try {
      const member = await Member.findByPk(req.params.id);
      if (!member) {
        return res.status(404).json({ message: 'Miembro no encontrado.' });
      }

      // Guardar valores anteriores para saber si hay que recalcular
      const prevChurchId = member.church_id;
      const prevRole = member.church_role;

      // Normalizar church_role vacío a null
      if (req.body.church_role === '') {
        req.body.church_role = null;
      }

      await member.update(req.body);

      // Recalcular si cambió el cargo o la iglesia
      const roleChanged = prevRole !== member.church_role;
      const churchChanged = prevChurchId !== member.church_id;

      if (roleChanged || churchChanged) {
        try {
          // Recalcular iglesia actual
          const currentChurch = await Church.findByPk(member.church_id);
          if (currentChurch) {
            await recalculateChurchRoleCounts(currentChurch);
            // Si cambió de iglesia, también recalcular membresía
            if (churchChanged) await recalculateMembershipCount(currentChurch);
          }

          // Si cambió de iglesia, también recalcular la anterior
          if (churchChanged && prevChurchId) {
            const prevChurch = await Church.findByPk(prevChurchId);
            if (prevChurch) {
              await recalculateChurchRoleCounts(prevChurch);
              await recalculateMembershipCount(prevChurch);
            }
          }
        } catch (statsErr) {
          console.error('[STATS] Error recalculando cargos:', statsErr.message);
        }
      }

      res.json({ message: 'Miembro actualizado exitosamente.', member });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar miembro.', error: error.message });
    }
  },

  /**
   * DELETE /api/members/:id
   * Eliminar miembro. Recalcula membership_count siempre,
   * y church_role counts si tenía cargo.
   */
  async delete(req, res) {
    try {
      const member = await Member.findByPk(req.params.id);
      if (!member) {
        return res.status(404).json({ message: 'Miembro no encontrado.' });
      }

      const churchId = member.church_id;
      const hadRole = !!member.church_role;

      await member.destroy();

      // Recalcular estadísticas de la iglesia
      if (churchId) {
        try {
          const church = await Church.findByPk(churchId);
          if (church) {
            // Siempre recalcular membresía al eliminar
            await recalculateMembershipCount(church);
            // Recalcular cargos si el miembro tenía cargo
            if (hadRole) await recalculateChurchRoleCounts(church);
          }
        } catch (statsErr) {
          console.error('[STATS] Error recalculando stats:', statsErr.message);
        }
      }

      res.json({ message: 'Miembro eliminado exitosamente.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar miembro.', error: error.message });
    }
  },
};

module.exports = memberController;

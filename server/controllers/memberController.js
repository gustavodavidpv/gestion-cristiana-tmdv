const { Member, Church, MinisterialPosition } = require('../models');
const { Op } = require('sequelize');
const { recalculateChurchRoleCounts, recalculateMembershipCount } = require('../utils/churchStats');
const { isSuperAdmin, applyTenantFilter } = require('../middleware/auth');

const memberController = {
  // GET /api/members?church_id=X&search=Y&member_type=Z&church_role=W
  async getAll(req, res) {
    try {
      const { church_id, member_type, church_role, position_id, baptized, search, page = 1, limit = 20 } = req.query;

      const where = {};
      if (church_id) where.church_id = church_id;
      if (member_type) where.member_type = member_type;
      if (church_role) where.church_role = church_role;
      if (position_id) where.position_id = position_id;
      if (baptized !== undefined) where.baptized = baptized === 'true';
      if (search) {
        where[Op.or] = [
          { first_name: { [Op.iLike]: `%${search}%` } },
          { last_name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ];
      }

      // Tenant filtering: SuperAdmin ve todo, otros su iglesia
      applyTenantFilter(where, req.user);

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows: members, count: total } = await Member.findAndCountAll({
        where,
        include: [
          { model: Church, as: 'church', attributes: ['id', 'name'] },
          { model: MinisterialPosition, as: 'position', attributes: ['id', 'name'] },
        ],
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
        include: [
          { model: Church, as: 'church', attributes: ['id', 'name'] },
          { model: MinisterialPosition, as: 'position', attributes: ['id', 'name'] },
        ],
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
        baptized, member_type, church_role, position_id, phone, email, address,
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
        church_role: church_role || null,
        position_id: position_id || null,
        phone,
        email,
        address,
      });

      // Recalcular estadísticas de la iglesia
      try {
        const church = await Church.findByPk(member.church_id);
        if (church) {
          await recalculateMembershipCount(church);
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
   * Actualizar miembro. Si cambió church_role, recalcular contadores.
   */
  async update(req, res) {
    try {
      const member = await Member.findByPk(req.params.id);
      if (!member) {
        return res.status(404).json({ message: 'Miembro no encontrado.' });
      }

      const prevChurchId = member.church_id;
      const prevRole = member.church_role;

      if (req.body.church_role === '') {
        req.body.church_role = null;
      }

      await member.update(req.body);

      const roleChanged = prevRole !== member.church_role;
      const churchChanged = prevChurchId !== member.church_id;

      if (roleChanged || churchChanged) {
        try {
          const currentChurch = await Church.findByPk(member.church_id);
          if (currentChurch) {
            await recalculateChurchRoleCounts(currentChurch);
            if (churchChanged) await recalculateMembershipCount(currentChurch);
          }

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

      if (churchId) {
        try {
          const church = await Church.findByPk(churchId);
          if (church) {
            await recalculateMembershipCount(church);
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

const { Church, Mission, WhiteField, Member } = require('../models');
const { isSuperAdmin } = require('../middleware/auth');

const churchController = {
  // GET /api/churches
  // SuperAdmin: lista todas. Admin: solo su iglesia.
  async getAll(req, res) {
    try {
      const where = {};

      // Admin solo ve su iglesia; SuperAdmin ve todas
      if (!isSuperAdmin(req.user) && req.user.church_id) {
        where.id = req.user.church_id;
      }

      const churches = await Church.findAll({
        where,
        order: [['name', 'ASC']],
      });
      res.json({ churches });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener iglesias.', error: error.message });
    }
  },

  // GET /api/churches/:id
  async getById(req, res) {
    try {
      const church = await Church.findByPk(req.params.id, {
        include: [
          {
            model: Mission,
            as: 'missions',
            include: [{ model: Member, as: 'responsible', attributes: ['id', 'first_name', 'last_name'] }],
          },
          {
            model: WhiteField,
            as: 'white_fields',
            include: [{ model: Member, as: 'responsible', attributes: ['id', 'first_name', 'last_name'] }],
          },
        ],
      });

      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      // Admin solo puede ver su propia iglesia
      if (!isSuperAdmin(req.user) && req.user.church_id !== church.id) {
        return res.status(403).json({ message: 'No tienes acceso a esta iglesia.' });
      }

      res.json({ church });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener iglesia.', error: error.message });
    }
  },

  // POST /api/churches — Solo SuperAdmin puede crear iglesias
  async create(req, res) {
    try {
      const church = await Church.create(req.body);
      res.status(201).json({ message: 'Iglesia creada exitosamente.', church });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear iglesia.', error: error.message });
    }
  },

  /**
   * PUT /api/churches/:id
   * Admin: solo su iglesia. SuperAdmin: cualquiera.
   * Campos calculados se protegen (no editables manualmente).
   */
  async update(req, res) {
    try {
      const church = await Church.findByPk(req.params.id);
      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      // Admin solo puede editar su propia iglesia
      if (!isSuperAdmin(req.user) && req.user.church_id !== church.id) {
        return res.status(403).json({ message: 'No tienes acceso a esta iglesia.' });
      }

      // Proteger campos calculados automáticamente
      const updateData = { ...req.body };
      delete updateData.faith_decisions_year;
      delete updateData.faith_decisions_ref_year;
      delete updateData.avg_weekly_attendance;
      delete updateData.ordained_preachers;
      delete updateData.unordained_preachers;
      delete updateData.ordained_deacons;
      delete updateData.unordained_deacons;
      delete updateData.membership_count;

      await church.update(updateData);
      res.json({ message: 'Iglesia actualizada exitosamente.', church });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar iglesia.', error: error.message });
    }
  },

  // DELETE /api/churches/:id — Solo SuperAdmin
  async delete(req, res) {
    try {
      const church = await Church.findByPk(req.params.id);
      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      await church.destroy();
      res.json({ message: 'Iglesia eliminada exitosamente.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar iglesia.', error: error.message });
    }
  },

  // =========== MISIONES ===========
  async createMission(req, res) {
    try {
      const mission = await Mission.create({ ...req.body, church_id: req.params.id });
      res.status(201).json({ message: 'Misión creada exitosamente.', mission });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear misión.', error: error.message });
    }
  },

  async updateMission(req, res) {
    try {
      const mission = await Mission.findByPk(req.params.missionId);
      if (!mission) return res.status(404).json({ message: 'Misión no encontrada.' });
      await mission.update(req.body);
      res.json({ message: 'Misión actualizada.', mission });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar misión.', error: error.message });
    }
  },

  async deleteMission(req, res) {
    try {
      const mission = await Mission.findByPk(req.params.missionId);
      if (!mission) return res.status(404).json({ message: 'Misión no encontrada.' });
      await mission.destroy();
      res.json({ message: 'Misión eliminada.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar misión.', error: error.message });
    }
  },

  // =========== CAMPOS BLANCOS ===========
  async createWhiteField(req, res) {
    try {
      const whiteField = await WhiteField.create({ ...req.body, church_id: req.params.id });
      res.status(201).json({ message: 'Campo blanco creado exitosamente.', whiteField });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear campo blanco.', error: error.message });
    }
  },

  async updateWhiteField(req, res) {
    try {
      const field = await WhiteField.findByPk(req.params.fieldId);
      if (!field) return res.status(404).json({ message: 'Campo blanco no encontrado.' });
      await field.update(req.body);
      res.json({ message: 'Campo blanco actualizado.', whiteField: field });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar campo blanco.', error: error.message });
    }
  },

  async deleteWhiteField(req, res) {
    try {
      const field = await WhiteField.findByPk(req.params.fieldId);
      if (!field) return res.status(404).json({ message: 'Campo blanco no encontrado.' });
      await field.destroy();
      res.json({ message: 'Campo blanco eliminado.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar campo blanco.', error: error.message });
    }
  },
};

module.exports = churchController;

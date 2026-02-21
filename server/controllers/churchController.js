const { Church, Mission, WhiteField, Member } = require('../models');

const churchController = {
  // GET /api/churches
  async getAll(req, res) {
    try {
      const churches = await Church.findAll({
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

      res.json({ church });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener iglesia.', error: error.message });
    }
  },

  // POST /api/churches
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
   * 
   * IMPORTANTE: Los campos faith_decisions_year y faith_decisions_ref_year
   * NO son editables manualmente desde la web. Se calculan automáticamente
   * a partir de los datos de EventAttendees de los eventos de la iglesia.
   * Por seguridad, se eliminan del payload antes de actualizar.
   */
  async update(req, res) {
    try {
      const church = await Church.findByPk(req.params.id);
      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      // Proteger TODOS los campos calculados automáticamente.
      // Estos se alimentan desde:
      //   - faith_decisions: desde EventAttendees
      //   - avg_weekly_attendance: desde WeeklyAttendance
      //   - ordained/unordained preachers/deacons: desde Members.church_role
      const updateData = { ...req.body };
      delete updateData.faith_decisions_year;
      delete updateData.faith_decisions_ref_year;
      delete updateData.avg_weekly_attendance;
      delete updateData.ordained_preachers;
      delete updateData.unordained_preachers;
      delete updateData.ordained_deacons;
      delete updateData.unordained_deacons;
      delete updateData.membership_count; // Calculado desde Members

      await church.update(updateData);
      res.json({ message: 'Iglesia actualizada exitosamente.', church });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar iglesia.', error: error.message });
    }
  },

  // DELETE /api/churches/:id
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

  // POST /api/churches/:id/missions
  async createMission(req, res) {
    try {
      const mission = await Mission.create({
        ...req.body,
        church_id: req.params.id,
      });
      res.status(201).json({ message: 'Misión creada exitosamente.', mission });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear misión.', error: error.message });
    }
  },

  // PUT /api/churches/:id/missions/:missionId
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

  // DELETE /api/churches/:id/missions/:missionId
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

  // POST /api/churches/:id/white-fields
  async createWhiteField(req, res) {
    try {
      const whiteField = await WhiteField.create({
        ...req.body,
        church_id: req.params.id,
      });
      res.status(201).json({ message: 'Campo blanco creado exitosamente.', whiteField });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear campo blanco.', error: error.message });
    }
  },

  // PUT /api/churches/:id/white-fields/:fieldId
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

  // DELETE /api/churches/:id/white-fields/:fieldId
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

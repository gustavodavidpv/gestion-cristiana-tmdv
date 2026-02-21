const { Minute, MinuteAttendee, Motion, MotionVoter, Member, Church, User } = require('../models');

const minuteController = {
  // GET /api/minutes
  async getAll(req, res) {
    try {
      const { church_id, page = 1, limit = 20 } = req.query;
      const where = {};

      if (church_id) where.church_id = church_id;
      if (req.user.role.name !== 'Administrador' && req.user.church_id) {
        where.church_id = req.user.church_id;
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows: minutes, count: total } = await Minute.findAndCountAll({
        where,
        include: [
          { model: Church, as: 'church', attributes: ['id', 'name'] },
          { model: User, as: 'creator', attributes: ['id', 'full_name'] },
        ],
        order: [['meeting_date', 'DESC']],
        limit: parseInt(limit),
        offset,
      });

      res.json({
        minutes,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener actas.', error: error.message });
    }
  },

  // GET /api/minutes/:id
  async getById(req, res) {
    try {
      const minute = await Minute.findByPk(req.params.id, {
        include: [
          { model: Church, as: 'church', attributes: ['id', 'name'] },
          { model: User, as: 'creator', attributes: ['id', 'full_name'] },
          {
            model: MinuteAttendee,
            as: 'attendees',
            include: [{ model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] }],
          },
          {
            model: Motion,
            as: 'motions',
            include: [{
              model: MotionVoter,
              as: 'voters',
              include: [{ model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] }],
            }],
            order: [['order_num', 'ASC']],
          },
        ],
      });

      if (!minute) {
        return res.status(404).json({ message: 'Acta no encontrada.' });
      }

      res.json({ minute });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener acta.', error: error.message });
    }
  },

  // POST /api/minutes
  async create(req, res) {
    try {
      const { title, objective, meeting_date, church_id, attendee_ids, motions } = req.body;

      // Crear el acta
      const minute = await Minute.create({
        title,
        objective,
        meeting_date,
        church_id: church_id || req.user.church_id,
        created_by: req.user.id,
      });

      // Agregar asistentes
      if (attendee_ids && attendee_ids.length > 0) {
        const attendeeRecords = attendee_ids.map((memberId) => ({
          minute_id: minute.id,
          member_id: memberId,
        }));
        await MinuteAttendee.bulkCreate(attendeeRecords);
      }

      // Agregar motivos
      if (motions && motions.length > 0) {
        for (let i = 0; i < motions.length; i++) {
          const m = motions[i];
          const motion = await Motion.create({
            minute_id: minute.id,
            title: m.title,
            description: m.description,
            result: m.result || 'Pendiente',
            order_num: i + 1,
          });

          // Agregar votantes/secundadores
          if (m.voters && m.voters.length > 0) {
            const voterRecords = m.voters.map((v) => ({
              motion_id: motion.id,
              member_id: v.member_id,
              vote_type: v.vote_type,
            }));
            await MotionVoter.bulkCreate(voterRecords);
          }
        }
      }

      // Obtener el acta completa
      const fullMinute = await Minute.findByPk(minute.id, {
        include: [
          {
            model: MinuteAttendee,
            as: 'attendees',
            include: [{ model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] }],
          },
          {
            model: Motion,
            as: 'motions',
            include: [{
              model: MotionVoter,
              as: 'voters',
              include: [{ model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] }],
            }],
          },
        ],
      });

      res.status(201).json({ message: 'Acta creada exitosamente.', minute: fullMinute });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear acta.', error: error.message });
    }
  },

  // PUT /api/minutes/:id
  async update(req, res) {
    try {
      const minute = await Minute.findByPk(req.params.id);
      if (!minute) {
        return res.status(404).json({ message: 'Acta no encontrada.' });
      }

      const { title, objective, meeting_date } = req.body;
      await minute.update({ title, objective, meeting_date });

      res.json({ message: 'Acta actualizada exitosamente.', minute });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar acta.', error: error.message });
    }
  },

  // POST /api/minutes/:id/upload
  async uploadFile(req, res) {
    try {
      const minute = await Minute.findByPk(req.params.id);
      if (!minute) {
        return res.status(404).json({ message: 'Acta no encontrada.' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo.' });
      }

      await minute.update({ file_url: `/uploads/minutes/${req.file.filename}` });
      res.json({ message: 'Archivo subido exitosamente.', file_url: minute.file_url });
    } catch (error) {
      res.status(500).json({ message: 'Error al subir archivo.', error: error.message });
    }
  },

  // DELETE /api/minutes/:id
  async delete(req, res) {
    try {
      const minute = await Minute.findByPk(req.params.id);
      if (!minute) return res.status(404).json({ message: 'Acta no encontrada.' });

      // Eliminar en cascada
      const motions = await Motion.findAll({ where: { minute_id: minute.id } });
      for (const motion of motions) {
        await MotionVoter.destroy({ where: { motion_id: motion.id } });
      }
      await Motion.destroy({ where: { minute_id: minute.id } });
      await MinuteAttendee.destroy({ where: { minute_id: minute.id } });
      await minute.destroy();

      res.json({ message: 'Acta eliminada exitosamente.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar acta.', error: error.message });
    }
  },
};

module.exports = minuteController;

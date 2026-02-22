const { Minute, MinuteAttendee, MinuteFile, Motion, MotionVoter, Member, Church, User } = require('../models');
const { applyTenantFilter } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const minuteController = {
  // GET /api/minutes
  async getAll(req, res) {
    try {
      const { church_id, page = 1, limit = 20 } = req.query;
      const where = {};

      if (church_id) where.church_id = church_id;
      // Tenant filtering: SuperAdmin ve todo, otros su iglesia
      applyTenantFilter(where, req.user);

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows: minutes, count: total } = await Minute.findAndCountAll({
        where,
        include: [
          { model: Church, as: 'church', attributes: ['id', 'name'] },
          { model: User, as: 'creator', attributes: ['id', 'full_name'] },
          { model: MinuteFile, as: 'files', attributes: ['id', 'file_url', 'original_name', 'file_size'] },
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
          { model: MinuteFile, as: 'files' },
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

      // Obtener acta completa
      const fullMinute = await Minute.findByPk(minute.id, {
        include: [
          { model: MinuteAttendee, as: 'attendees', include: [{ model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] }] },
          { model: Motion, as: 'motions', include: [{ model: MotionVoter, as: 'voters', include: [{ model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] }] }] },
          { model: MinuteFile, as: 'files' },
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

  // =========== ARCHIVOS (MULTI-FILE) ===========

  /**
   * POST /api/minutes/:id/upload
   * Sube uno o varios archivos para una acta.
   * req.files viene de multer (array mode).
   */
  async uploadFiles(req, res) {
    try {
      const minute = await Minute.findByPk(req.params.id);
      if (!minute) {
        return res.status(404).json({ message: 'Acta no encontrada.' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No se subió ningún archivo.' });
      }

      // Crear registros de MinuteFile para cada archivo subido
      const fileRecords = req.files.map((file) => ({
        minute_id: minute.id,
        file_url: `/uploads/minutes/${file.filename}`,
        original_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype,
      }));

      const createdFiles = await MinuteFile.bulkCreate(fileRecords);

      // Actualizar file_url del acta con el primer archivo (compatibilidad)
      if (!minute.file_url && createdFiles.length > 0) {
        await minute.update({ file_url: createdFiles[0].file_url });
      }

      res.json({
        message: `${createdFiles.length} archivo(s) subido(s) exitosamente.`,
        files: createdFiles,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al subir archivo(s).', error: error.message });
    }
  },

  /**
   * DELETE /api/minutes/:id/files/:fileId
   * Elimina un archivo específico de una acta.
   */
  async deleteFile(req, res) {
    try {
      const file = await MinuteFile.findByPk(req.params.fileId);
      if (!file || file.minute_id !== parseInt(req.params.id)) {
        return res.status(404).json({ message: 'Archivo no encontrado.' });
      }

      // Eliminar archivo físico del disco
      const filePath = path.join(__dirname, '..', 'public', file.file_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await file.destroy();
      res.json({ message: 'Archivo eliminado exitosamente.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar archivo.', error: error.message });
    }
  },

  // DELETE /api/minutes/:id
  async delete(req, res) {
    try {
      const minute = await Minute.findByPk(req.params.id);
      if (!minute) return res.status(404).json({ message: 'Acta no encontrada.' });

      // Eliminar archivos físicos
      const files = await MinuteFile.findAll({ where: { minute_id: minute.id } });
      for (const file of files) {
        const filePath = path.join(__dirname, '..', 'public', file.file_url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Eliminar en cascada
      await MinuteFile.destroy({ where: { minute_id: minute.id } });
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

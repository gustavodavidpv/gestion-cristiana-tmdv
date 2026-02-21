const { Event, EventAttendee, Member, Church, User } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { recalculateChurchFaithDecisions } = require('../utils/churchStats');

const eventController = {
  // GET /api/events
  // Lista todos los eventos con paginación, filtros por tipo y fechas
  async getAll(req, res) {
    try {
      const { church_id, event_type, start_date, end_date, page = 1, limit = 20 } = req.query;

      const where = {};
      if (church_id) where.church_id = church_id;
      if (event_type) where.event_type = event_type;
      if (start_date && end_date) {
        where.start_date = { [Op.between]: [start_date, end_date] };
      }

      // Los no-administradores solo ven eventos de su iglesia
      if (req.user.role.name !== 'Administrador' && req.user.church_id) {
        where.church_id = req.user.church_id;
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows: events, count: total } = await Event.findAndCountAll({
        where,
        include: [
          { model: Church, as: 'church', attributes: ['id', 'name'] },
          { model: User, as: 'creator', attributes: ['id', 'full_name'] },
        ],
        order: [['start_date', 'DESC']],
        limit: parseInt(limit),
        offset,
      });

      res.json({
        events,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener eventos.', error: error.message });
    }
  },

  // GET /api/events/:id
  // Detalle de un evento con sus asistentes y datos del miembro
  async getById(req, res) {
    try {
      const event = await Event.findByPk(req.params.id, {
        include: [
          { model: Church, as: 'church', attributes: ['id', 'name'] },
          { model: User, as: 'creator', attributes: ['id', 'full_name'] },
          {
            model: EventAttendee,
            as: 'attendees',
            include: [{ model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name', 'member_type'] }],
          },
        ],
      });

      if (!event) {
        return res.status(404).json({ message: 'Evento no encontrado.' });
      }

      res.json({ event });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener evento.', error: error.message });
    }
  },

  // POST /api/events
  // Crear un nuevo evento
  async create(req, res) {
    try {
      const event = await Event.create({
        ...req.body,
        church_id: req.body.church_id || req.user.church_id,
        created_by: req.user.id,
      });

      res.status(201).json({ message: 'Evento creado exitosamente.', event });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear evento.', error: error.message });
    }
  },

  // PUT /api/events/:id
  // Actualizar datos básicos del evento (no asistentes)
  async update(req, res) {
    try {
      const event = await Event.findByPk(req.params.id);
      if (!event) {
        return res.status(404).json({ message: 'Evento no encontrado.' });
      }

      await event.update(req.body);
      res.json({ message: 'Evento actualizado exitosamente.', event });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar evento.', error: error.message });
    }
  },

  // DELETE /api/events/:id
  // Eliminar evento y recalcular estadísticas de la iglesia
  async delete(req, res) {
    try {
      const event = await Event.findByPk(req.params.id);
      if (!event) return res.status(404).json({ message: 'Evento no encontrado.' });

      const churchId = event.church_id;

      // Eliminar asistentes asociados primero (por seguridad, aunque cascade lo haría)
      await EventAttendee.destroy({ where: { event_id: event.id } });
      await event.destroy();

      // Recalcular decisiones de fe de la iglesia tras eliminar el evento
      if (churchId) {
        const church = await Church.findByPk(churchId);
        if (church) {
          await recalculateChurchFaithDecisions(church);
        }
      }

      res.json({ message: 'Evento eliminado exitosamente.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar evento.', error: error.message });
    }
  },

  // =========== ASISTENTES ===========

  /**
   * POST /api/events/:id/attendees
   * 
   * ESTRATEGIA DE REEMPLAZO COMPLETO (fix del bug de duplicados):
   * 
   * 1. Se usa una TRANSACCIÓN para garantizar integridad
   * 2. Se ELIMINAN todos los asistentes previos del evento
   * 3. Se INSERTAN los nuevos asistentes (ya deduplicados por member_id)
   * 4. Se recalculan los contadores del evento
   * 5. Se recalculan las decisiones de fe de la iglesia
   * 
   * Esto evita:
   * - Duplicados (el frontend envía la lista completa, no incremental)
   * - Errores de updateOnDuplicate que fallaban sin índice único
   * - Inconsistencias en los contadores
   */
  async addAttendees(req, res) {
    // Iniciar transacción para garantizar integridad de datos
    const transaction = await sequelize.transaction();

    try {
      const eventId = parseInt(req.params.id);
      const { attendees } = req.body; // Array: [{ member_id, attended, made_faith_decision, notes }]

      // Validar que el evento existe
      const event = await Event.findByPk(eventId, { transaction });
      if (!event) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Evento no encontrado.' });
      }

      // Validar que se recibieron asistentes
      if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Debe proporcionar al menos un asistente.' });
      }

      // PASO 1: Deduplicar por member_id en caso de que el frontend envíe duplicados
      const uniqueMap = new Map();
      attendees.forEach((a) => {
        // Si hay duplicados, el último gana (sobrescribe)
        uniqueMap.set(a.member_id, {
          event_id: eventId,
          member_id: a.member_id,
          attended: a.attended !== undefined ? a.attended : true,
          made_faith_decision: a.made_faith_decision || false,
          notes: a.notes || null,
        });
      });
      const uniqueRecords = Array.from(uniqueMap.values());

      // PASO 2: Eliminar todos los asistentes previos de este evento
      await EventAttendee.destroy({
        where: { event_id: eventId },
        transaction,
      });

      // PASO 3: Insertar los nuevos registros (ya deduplicados)
      await EventAttendee.bulkCreate(uniqueRecords, { transaction });

      // PASO 4: Recalcular contadores del evento
      const totalAttendees = uniqueRecords.filter((r) => r.attended).length;
      const totalFaithDecisions = uniqueRecords.filter((r) => r.made_faith_decision).length;

      await event.update({
        attendees_count: totalAttendees,
        faith_decisions: totalFaithDecisions,
      }, { transaction });

      // Confirmar transacción antes de recalcular la iglesia
      await transaction.commit();

      // PASO 5: Recalcular decisiones de fe de la iglesia (fuera de transacción)
      if (event.church_id) {
        try {
          const church = await Church.findByPk(event.church_id);
          if (church) {
            await recalculateChurchFaithDecisions(church);
          }
        } catch (statsError) {
          // Si falla el recálculo de stats, no afecta los asistentes guardados
          console.error('[STATS] Error recalculando stats de iglesia:', statsError.message);
        }
      }

      res.json({
        message: 'Asistentes registrados exitosamente.',
        attendees_count: totalAttendees,
        faith_decisions: totalFaithDecisions,
      });
    } catch (error) {
      // Rollback si hubo error durante la transacción
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('[ATTENDEES ERROR]', error);
      res.status(500).json({ message: 'Error al registrar asistentes.', error: error.message });
    }
  },
};

module.exports = eventController;

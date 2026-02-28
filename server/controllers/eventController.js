const { Event, EventAttendee, Member, Church, User } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { recalculateChurchFaithDecisions } = require('../utils/churchStats');
const { generateCalendarPdf } = require('../utils/calendarPdf');
const { generateSalesCalendarPdf } = require('../utils/salesCalendarPdf');
const { isSuperAdmin, applyTenantFilter } = require('../middleware/auth');

/**
 * Includes comunes para cargar roles de culto junto con cada evento.
 * Cada rol es un Member opcional (preacher, worship_leader, singer).
 * Solo tienen sentido cuando event_type === 'Culto'.
 */
const CULTO_ROLE_INCLUDES = [
  { model: Member, as: 'preacher', attributes: ['id', 'first_name', 'last_name', 'phone'] },
  { model: Member, as: 'worship_leader', attributes: ['id', 'first_name', 'last_name', 'phone'] },
  { model: Member, as: 'singer', attributes: ['id', 'first_name', 'last_name', 'phone'] },
];

/**
 * Sanitiza IDs de roles de culto: '' → null, string → int.
 * Evita errores de FK cuando el frontend envía strings vacíos.
 */
function sanitizeCultoRoles(data) {
  ['preacher_id', 'worship_leader_id', 'singer_id'].forEach((field) => {
    if (data[field] === '' || data[field] === undefined) {
      data[field] = null;
    } else if (data[field] !== null) {
      const parsed = parseInt(data[field], 10);
      data[field] = isNaN(parsed) ? null : parsed;
    }
  });
  return data;
}

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

      // Tenant filtering: SuperAdmin ve todo, otros su iglesia
      applyTenantFilter(where, req.user);

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows: events, count: total } = await Event.findAndCountAll({
        where,
        include: [
          { model: Church, as: 'church', attributes: ['id', 'name'] },
          { model: User, as: 'creator', attributes: ['id', 'full_name'] },
          // Incluir roles de culto para mostrar en tabla
          ...CULTO_ROLE_INCLUDES,
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
          // Roles de culto
          ...CULTO_ROLE_INCLUDES,
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
  async create(req, res) {
    try {
      // Sanitizar IDs de roles de culto ('' → null)
      const data = sanitizeCultoRoles({ ...req.body });

      const event = await Event.create({
        ...data,
        church_id: data.church_id || req.user.church_id,
        created_by: req.user.id,
      });

      res.status(201).json({ message: 'Evento creado exitosamente.', event });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear evento.', error: error.message });
    }
  },

  // PUT /api/events/:id
  async update(req, res) {
    try {
      const event = await Event.findByPk(req.params.id);
      if (!event) {
        return res.status(404).json({ message: 'Evento no encontrado.' });
      }

      // Sanitizar IDs de roles de culto ('' → null)
      const data = sanitizeCultoRoles({ ...req.body });

      /**
       * Si el tipo de evento cambia de 'Culto' a otro tipo,
       * limpiar los roles de culto para no dejar datos huérfanos.
       */
      if (data.event_type && data.event_type !== 'Culto') {
        data.preacher_id = null;
        data.worship_leader_id = null;
        data.singer_id = null;
      }

      await event.update(data);
      res.json({ message: 'Evento actualizado exitosamente.', event });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar evento.', error: error.message });
    }
  },

  // DELETE /api/events/:id
  async delete(req, res) {
    try {
      const event = await Event.findByPk(req.params.id);
      if (!event) return res.status(404).json({ message: 'Evento no encontrado.' });

      const churchId = event.church_id;
      await EventAttendee.destroy({ where: { event_id: event.id } });
      await event.destroy();

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
   * REPLACE strategy: delete all + insert con transacción.
   */
  async addAttendees(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const eventId = parseInt(req.params.id);
      const { attendees } = req.body;

      const event = await Event.findByPk(eventId, { transaction });
      if (!event) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Evento no encontrado.' });
      }

      if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Debe proporcionar al menos un asistente.' });
      }

      // Deduplicar por member_id
      const uniqueMap = new Map();
      attendees.forEach((a) => {
        uniqueMap.set(a.member_id, {
          event_id: eventId,
          member_id: a.member_id,
          attended: a.attended !== undefined ? a.attended : true,
          made_faith_decision: a.made_faith_decision || false,
          notes: a.notes || null,
        });
      });
      const uniqueRecords = Array.from(uniqueMap.values());

      // Eliminar + Insertar
      await EventAttendee.destroy({ where: { event_id: eventId }, transaction });
      await EventAttendee.bulkCreate(uniqueRecords, { transaction });

      const totalAttendees = uniqueRecords.filter((r) => r.attended).length;
      const totalFaithDecisions = uniqueRecords.filter((r) => r.made_faith_decision).length;

      await event.update({
        attendees_count: totalAttendees,
        faith_decisions: totalFaithDecisions,
      }, { transaction });

      await transaction.commit();

      // Recalcular stats de iglesia
      if (event.church_id) {
        try {
          const church = await Church.findByPk(event.church_id);
          if (church) await recalculateChurchFaithDecisions(church);
        } catch (statsError) {
          console.error('[STATS] Error recalculando stats:', statsError.message);
        }
      }

      res.json({
        message: 'Asistentes registrados exitosamente.',
        attendees_count: totalAttendees,
        faith_decisions: totalFaithDecisions,
      });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      console.error('[ATTENDEES ERROR]', error);
      res.status(500).json({ message: 'Error al registrar asistentes.', error: error.message });
    }
  },

  // =========== CALENDARIO PDF ===========

  /**
   * GET /api/events/calendar-pdf?year=2026&month=3
   * 
   * Genera PDF con calendario mensual.
   * MEJORA: Incluye roles de culto (P, D, C) para eventos tipo Culto.
   */
  async generateCalendar(req, res) {
    try {
      const year = parseInt(req.query.year);
      const month = parseInt(req.query.month);

      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({
          message: 'Parámetros inválidos. Se requiere year (ej: 2026) y month (1-12).',
        });
      }

      // Rango del mes
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Buscar eventos que SOLAPAN el mes
      const where = {
        [Op.and]: [
          { start_date: { [Op.lte]: endDate } },
          {
            [Op.or]: [
              { end_date: { [Op.gte]: startDate } },
              {
                [Op.and]: [
                  { end_date: null },
                  { start_date: { [Op.gte]: startDate } },
                ],
              },
            ],
          },
        ],
      };

      // Tenant filtering
      applyTenantFilter(where, req.user);

      const events = await Event.findAll({
        where,
        include: [
          // Incluir roles de culto para mostrar P:/D:/C: en el PDF
          ...CULTO_ROLE_INCLUDES,
        ],
        order: [['start_date', 'ASC']],
        attributes: [
          'id', 'title', 'event_type', 'start_date', 'end_date', 'location',
          'preacher_id', 'worship_leader_id', 'singer_id',
        ],
      });

      // Obtener nombre de la iglesia
      let churchName = 'Gestión Cristiana TMDV';
      if (req.user.church_id) {
        const church = await Church.findByPk(req.user.church_id, { attributes: ['name'] });
        if (church) churchName = church.name;
      }

      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
      ];

      const fileName = `Calendario_${monthNames[month - 1]}_${year}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      /**
       * Convertir a JSON plano incluyendo los roles de culto.
       * El generador PDF necesita: preacher, worship_leader, singer como objetos
       * con {first_name, last_name} para imprimir P:/D:/C:.
       */
      const eventsJson = events.map((e) => {
        const json = e.toJSON();
        return {
          ...json,
          // Nombres cortos para el PDF (ej: "Moisés", "Xenia")
          preacher_name: json.preacher
            ? `${json.preacher.first_name}`
            : null,
          worship_leader_name: json.worship_leader
            ? `${json.worship_leader.first_name}`
            : null,
          singer_name: json.singer
            ? `${json.singer.first_name}`
            : null,
        };
      });

      const pdfDoc = generateCalendarPdf({
        year,
        month,
        churchName,
        events: eventsJson,
      });

      pdfDoc.pipe(res);

    } catch (error) {
      console.error('[CALENDAR PDF ERROR]', error);
      res.status(500).json({ message: 'Error al generar calendario PDF.', error: error.message });
    }
  },

  // =========== CALENDARIO DE VENTAS PDF ===========

  /**
   * GET /api/events/sales-calendar-pdf?year=2026
   * 
   * Genera PDF con calendario de ventas anual.
   * Muestra todos los eventos de tipo "Ventas" del año,
   * organizados por meses en columnas (estilo poster/cartelera).
   */
  async generateSalesCalendar(req, res) {
    try {
      const year = parseInt(req.query.year);

      if (!year || year < 2000 || year > 2100) {
        return res.status(400).json({
          message: 'Parámetro inválido. Se requiere year (ej: 2026).',
        });
      }

      // Rango del año completo
      const startDate = new Date(year, 0, 1);       // 1 de Enero
      const endDate = new Date(year, 11, 31, 23, 59, 59); // 31 de Diciembre

      // Buscar SOLO eventos tipo "Ventas" del año
      const where = {
        event_type: 'Ventas',
        start_date: { [Op.between]: [startDate, endDate] },
      };

      // Tenant filtering
      applyTenantFilter(where, req.user);

      const events = await Event.findAll({
        where,
        order: [['start_date', 'ASC']],
        attributes: ['id', 'title', 'event_type', 'start_date'],
      });

      // Obtener nombre de la iglesia
      let churchName = 'Gestión Cristiana TMDV';
      if (req.user.church_id) {
        const church = await Church.findByPk(req.user.church_id, { attributes: ['name'] });
        if (church) churchName = church.name;
      }

      const fileName = `Calendario_Ventas_${year}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      const pdfDoc = generateSalesCalendarPdf({
        year,
        churchName,
        events: events.map((e) => e.toJSON()),
      });

      pdfDoc.pipe(res);

    } catch (error) {
      console.error('[SALES CALENDAR PDF ERROR]', error);
      res.status(500).json({ message: 'Error al generar calendario de ventas PDF.', error: error.message });
    }
  },
};

module.exports = eventController;

/**
 * notificationController.js - Controlador de notificaciones WhatsApp
 * 
 * Endpoints:
 * - GET  /api/notifications/status            → Estado de configuración WhatsApp
 * - GET  /api/notifications/schedule          → Obtener horarios configurados
 * - PUT  /api/notifications/schedule          → Guardar horarios de notificación
 * - GET  /api/notifications/upcoming-cultos   → Cultos próximos con roles asignados
 * - POST /api/notifications/send-reminders    → Envío manual de recordatorios (todos)
 * - POST /api/notifications/send/:eventId     → Enviar recordatorio manual para un culto
 * 
 * Las notificaciones automáticas se disparan desde notificationScheduler.js
 * (cron job cada hora) según las horas configuradas por iglesia.
 */

const { Event, Member, Church } = require('../models');
const { Op } = require('sequelize');
const { sendCultoReminders } = require('../utils/whatsappService');
const { applyTenantFilter } = require('../middleware/auth');

/**
 * Busca cultos con roles asignados para una fecha específica
 * y envía recordatorios por WhatsApp a los miembros.
 * 
 * @param {Date} targetDate - Fecha del culto (se buscan cultos ese día)
 * @param {string} type - 'reminder' (día anterior) o 'today' (mismo día)
 * @param {number|null} churchId - Filtrar por iglesia, null para todas
 * @returns {Object} Resumen de envíos
 */
async function processRemindersForDate(targetDate, type, churchId = null) {
  // Rango del día: desde 00:00 hasta 23:59
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const where = {
    event_type: 'Culto',
    start_date: { [Op.between]: [startOfDay, endOfDay] },
    // Al menos uno de los roles debe estar asignado
    [Op.or]: [
      { preacher_id: { [Op.ne]: null } },
      { worship_leader_id: { [Op.ne]: null } },
      { singer_id: { [Op.ne]: null } },
    ],
  };

  // Filtrar por iglesia si se especifica
  if (churchId) {
    where.church_id = churchId;
  }

  const cultos = await Event.findAll({
    where,
    include: [
      { model: Member, as: 'preacher', attributes: ['id', 'first_name', 'last_name', 'phone'] },
      { model: Member, as: 'worship_leader', attributes: ['id', 'first_name', 'last_name', 'phone'] },
      { model: Member, as: 'singer', attributes: ['id', 'first_name', 'last_name', 'phone'] },
      { model: Church, as: 'church', attributes: ['id', 'name'] },
    ],
  });

  console.log(`[NOTIFICATIONS] Encontrados ${cultos.length} cultos con roles para ${targetDate.toISOString().slice(0, 10)} (tipo: ${type})`);

  const summary = { total_cultos: cultos.length, total_sent: 0, total_failed: 0, total_skipped: 0, details: [] };

  for (const culto of cultos) {
    const churchName = culto.church?.name || 'Iglesia';
    const result = await sendCultoReminders(culto, type, churchName);

    summary.total_sent += result.sent;
    summary.total_failed += result.failed;
    summary.total_skipped += result.skipped;
    summary.details.push({
      event_id: culto.id,
      title: culto.title,
      date: culto.start_date,
      church: churchName,
      ...result,
    });
  }

  return summary;
}

const notificationController = {
  /**
   * GET /api/notifications/status
   * Retorna el estado de la configuración de WhatsApp.
   */
  async getStatus(req, res) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    res.json({
      whatsapp_configured: !!(token && phoneId),
      has_token: !!token,
      has_phone_id: !!phoneId,
      message: token && phoneId
        ? 'WhatsApp configurado correctamente. Las notificaciones están activas.'
        : 'WhatsApp NO configurado. Agregue WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en las variables de entorno.',
    });
  },

  /**
   * GET /api/notifications/schedule
   * Retorna los horarios de notificación configurados para la iglesia del usuario.
   */
  async getSchedule(req, res) {
    try {
      const churchId = req.user.church_id;
      if (!churchId) {
        return res.json({ notification_day_before_hour: null, notification_same_day_hour: null });
      }

      const church = await Church.findByPk(churchId, {
        attributes: ['id', 'name', 'notification_day_before_hour', 'notification_same_day_hour'],
      });

      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      res.json({
        church_id: church.id,
        church_name: church.name,
        notification_day_before_hour: church.notification_day_before_hour,
        notification_same_day_hour: church.notification_same_day_hour,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener horario.', error: error.message });
    }
  },

  /**
   * PUT /api/notifications/schedule
   * 
   * Guarda los horarios de notificación para la iglesia del usuario.
   * Body: { notification_day_before_hour: 18, notification_same_day_hour: 7 }
   * Usar null para desactivar una notificación.
   */
  async saveSchedule(req, res) {
    try {
      const churchId = req.user.church_id;
      if (!churchId) {
        return res.status(400).json({ message: 'Usuario sin iglesia asignada.' });
      }

      const church = await Church.findByPk(churchId);
      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      const { notification_day_before_hour, notification_same_day_hour } = req.body;

      // Validar horas (0-23 o null para desactivar)
      const validateHour = (h) => {
        if (h === null || h === '' || h === undefined) return null;
        const parsed = parseInt(h, 10);
        if (isNaN(parsed) || parsed < 0 || parsed > 23) return null;
        return parsed;
      };

      await church.update({
        notification_day_before_hour: validateHour(notification_day_before_hour),
        notification_same_day_hour: validateHour(notification_same_day_hour),
      });

      console.log(`[NOTIFICATIONS] Horario actualizado para "${church.name}": día anterior=${church.notification_day_before_hour}h, mismo día=${church.notification_same_day_hour}h`);

      res.json({
        message: 'Horario de notificaciones guardado exitosamente.',
        notification_day_before_hour: church.notification_day_before_hour,
        notification_same_day_hour: church.notification_same_day_hour,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al guardar horario.', error: error.message });
    }
  },

  /**
   * GET /api/notifications/upcoming-cultos
   * 
   * Lista los próximos cultos (7 días) que tienen roles asignados.
   * Útil para el módulo de notificaciones: ver a quién se le notificará.
   */
  async getUpcomingCultos(req, res) {
    try {
      const now = new Date();
      const inSevenDays = new Date();
      inSevenDays.setDate(now.getDate() + 7);

      const where = {
        event_type: 'Culto',
        start_date: { [Op.between]: [now, inSevenDays] },
        // Al menos uno de los roles debe estar asignado
        [Op.or]: [
          { preacher_id: { [Op.ne]: null } },
          { worship_leader_id: { [Op.ne]: null } },
          { singer_id: { [Op.ne]: null } },
        ],
      };

      // Tenant filtering
      applyTenantFilter(where, req.user);

      const cultos = await Event.findAll({
        where,
        include: [
          { model: Member, as: 'preacher', attributes: ['id', 'first_name', 'last_name', 'phone'] },
          { model: Member, as: 'worship_leader', attributes: ['id', 'first_name', 'last_name', 'phone'] },
          { model: Member, as: 'singer', attributes: ['id', 'first_name', 'last_name', 'phone'] },
        ],
        order: [['start_date', 'ASC']],
      });

      res.json({ cultos });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener cultos próximos.', error: error.message });
    }
  },

  /**
   * POST /api/notifications/send-reminders
   * 
   * Envía recordatorios manualmente para todos los cultos de una fecha.
   * Body: { type: 'reminder'|'today', date: 'YYYY-MM-DD' }
   */
  async sendReminders(req, res) {
    try {
      const { type, date } = req.body || {};
      let targetDate;
      let reminderType = type || 'reminder';

      if (date) {
        targetDate = new Date(date + 'T00:00:00');
      } else {
        targetDate = new Date();
        if (reminderType === 'reminder') {
          targetDate.setDate(targetDate.getDate() + 1);
        }
      }

      const churchId = req.user.church_id || null;

      console.log(`[NOTIFICATIONS] Envío manual: tipo=${reminderType}, fecha=${targetDate.toISOString().slice(0, 10)}, iglesia=${churchId || 'todas'}`);

      const summary = await processRemindersForDate(targetDate, reminderType, churchId);

      res.json({
        message: `Recordatorios procesados: ${summary.total_sent} enviados, ${summary.total_failed} fallidos, ${summary.total_skipped} omitidos.`,
        summary,
      });
    } catch (error) {
      console.error('[NOTIFICATIONS ERROR]', error);
      res.status(500).json({ message: 'Error al enviar recordatorios.', error: error.message });
    }
  },

  /**
   * POST /api/notifications/send/:eventId
   * 
   * Envía recordatorio manual para un culto específico.
   * Body opcional: { type: 'reminder'|'today' }
   */
  async sendForEvent(req, res) {
    try {
      const eventId = parseInt(req.params.eventId);
      const { type } = req.body || {};

      const event = await Event.findByPk(eventId, {
        include: [
          { model: Member, as: 'preacher', attributes: ['id', 'first_name', 'last_name', 'phone'] },
          { model: Member, as: 'worship_leader', attributes: ['id', 'first_name', 'last_name', 'phone'] },
          { model: Member, as: 'singer', attributes: ['id', 'first_name', 'last_name', 'phone'] },
          { model: Church, as: 'church', attributes: ['id', 'name'] },
        ],
      });

      if (!event) {
        return res.status(404).json({ message: 'Evento no encontrado.' });
      }

      if (event.event_type !== 'Culto') {
        return res.status(400).json({ message: 'Solo se pueden enviar recordatorios para eventos tipo Culto.' });
      }

      const churchName = event.church?.name || 'Iglesia';
      const result = await sendCultoReminders(event, type || 'reminder', churchName);

      res.json({
        message: `Notificación enviada: ${result.sent} enviados, ${result.failed} fallidos, ${result.skipped} omitidos.`,
        result,
      });
    } catch (error) {
      console.error('[NOTIFICATION SEND ERROR]', error);
      res.status(500).json({ message: 'Error al enviar notificación.', error: error.message });
    }
  },
};

module.exports = { notificationController, processRemindersForDate };

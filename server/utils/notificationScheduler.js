/**
 * notificationScheduler.js - Programador de notificaciones automáticas
 * 
 * FUNCIONAMIENTO:
 * - Un cron job se ejecuta cada hora en punto (minuto 0).
 * - Para cada iglesia, compara la hora actual con las horas configuradas:
 *   1. notification_day_before_hour → Envía recordatorio para cultos de MAÑANA
 *   2. notification_same_day_hour   → Envía recordatorio para cultos de HOY
 * - Las horas son configurables desde el módulo de Notificaciones (frontend).
 * - Si el campo es null, esa notificación queda desactivada para esa iglesia.
 * 
 * REQUISITOS:
 * - npm install node-cron
 * - Variables de entorno: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 * 
 * ZONA HORARIA: America/Panama (UTC-5)
 */

let cron;
try {
  cron = require('node-cron');
} catch (err) {
  console.warn('[SCHEDULER] node-cron no está instalado. Las notificaciones automáticas están desactivadas.');
  console.warn('[SCHEDULER] Para activarlas: npm install node-cron');
}

const { processRemindersForDate } = require('../controllers/notificationController');

/**
 * Inicia el cron job que revisa cada hora si debe enviar notificaciones.
 * 
 * Solo se activa si:
 * 1. node-cron está instalado
 * 2. Las variables WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID están configuradas
 * 
 * Se llama desde server/index.js al iniciar la aplicación.
 */
function startNotificationScheduler() {
  // Verificar que node-cron esté disponible
  if (!cron) {
    console.log('[SCHEDULER] node-cron no disponible. Scheduler desactivado.');
    return;
  }

  // Verificar que WhatsApp esté configurado
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log('[SCHEDULER] WhatsApp no configurado. Scheduler desactivado.');
    console.log('[SCHEDULER] Configure WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID para activar.');
    return;
  }

  console.log('[SCHEDULER] ✅ Iniciando scheduler de notificaciones WhatsApp...');

  /**
   * CRON: Se ejecuta cada hora en punto (minuto 0).
   * Lee de la BD las horas configuradas por cada iglesia y envía
   * notificaciones si la hora actual coincide.
   * 
   * Ejemplo: Si la iglesia "Central" tiene notification_day_before_hour = 18
   * y son las 18:00, envía recordatorios para los cultos de mañana.
   */
  cron.schedule('0 * * * *', async () => {
    try {
      // Importar Church aquí (lazy) para evitar problemas de dependencias circulares
      const { Church } = require('../models');

      // Obtener hora actual en zona horaria de Panamá
      const now = new Date();
      // Convertir a hora Panamá (UTC-5)
      const panamaOffset = -5;
      const utcHour = now.getUTCHours();
      const panamaHour = (utcHour + panamaOffset + 24) % 24;

      console.log(`[SCHEDULER] ⏰ Verificando notificaciones (hora Panamá: ${panamaHour}:00)...`);

      // Buscar iglesias que tengan notificaciones configuradas para esta hora
      const { Op } = require('sequelize');

      // Iglesias con recordatorio DÍA ANTERIOR a esta hora
      const churchesDayBefore = await Church.findAll({
        where: { notification_day_before_hour: panamaHour },
        attributes: ['id', 'name'],
      });

      // Iglesias con recordatorio MISMO DÍA a esta hora
      const churchesSameDay = await Church.findAll({
        where: { notification_same_day_hour: panamaHour },
        attributes: ['id', 'name'],
      });

      // Procesar recordatorios del DÍA ANTERIOR
      for (const church of churchesDayBefore) {
        console.log(`[SCHEDULER] 🔔 Iglesia "${church.name}": Enviando recordatorios para cultos de mañana...`);
        try {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const summary = await processRemindersForDate(tomorrow, 'reminder', church.id);
          console.log(`[SCHEDULER] ✅ ${church.name}: ${summary.total_sent} enviados, ${summary.total_failed} fallidos.`);
        } catch (err) {
          console.error(`[SCHEDULER] ❌ ${church.name}: Error día anterior:`, err.message);
        }
      }

      // Procesar recordatorios del MISMO DÍA
      for (const church of churchesSameDay) {
        console.log(`[SCHEDULER] 🔔 Iglesia "${church.name}": Enviando recordatorios para cultos de hoy...`);
        try {
          const today = new Date();
          const summary = await processRemindersForDate(today, 'today', church.id);
          console.log(`[SCHEDULER] ✅ ${church.name}: ${summary.total_sent} enviados, ${summary.total_failed} fallidos.`);
        } catch (err) {
          console.error(`[SCHEDULER] ❌ ${church.name}: Error mismo día:`, err.message);
        }
      }

      if (churchesDayBefore.length === 0 && churchesSameDay.length === 0) {
        // Solo log cada 6 horas para no saturar
        if (panamaHour % 6 === 0) {
          console.log(`[SCHEDULER] ℹ️ Ninguna iglesia tiene notificaciones a las ${panamaHour}:00.`);
        }
      }
    } catch (error) {
      console.error('[SCHEDULER] ❌ Error general:', error.message);
    }
  }, {
    timezone: 'America/Panama',
  });

  console.log('[SCHEDULER] ✅ Cron job programado: cada hora en punto');
  console.log('[SCHEDULER]   → Verifica horas configuradas por iglesia en BD');
}

module.exports = { startNotificationScheduler };

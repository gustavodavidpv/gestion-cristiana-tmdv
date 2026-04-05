/**
 * whatsappService.js - Servicio de notificaciones por WhatsApp (Templates)
 * 
 * Integración con la API de WhatsApp Business Cloud (Meta).
 * Envía recordatorios a los miembros asignados a roles de culto usando
 * PLANTILLAS (templates) en vez de mensajes de texto libre.
 * 
 * ¿POR QUÉ TEMPLATES?
 * WhatsApp Business Cloud API solo permite enviar mensajes de texto libre
 * si el usuario escribió primero en las últimas 24h. Con templates aprobados,
 * se puede enviar en cualquier momento sin depender de esa ventana.
 * 
 * CONFIGURACIÓN REQUERIDA en .env:
 *   WHATSAPP_TOKEN=tu_token_de_acceso_de_meta
 *   WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id_de_meta
 *   WHATSAPP_TEMPLATE_NAME=culto_recordatorio  (opcional, default: 'culto_recordatorio')
 *   WHATSAPP_TEMPLATE_LANG=es                  (opcional, default: 'es')
 * 
 * TEMPLATE RECOMENDADO (crear en Meta Business Manager):
 * ─────────────────────────────────────────────
 * Nombre: culto_recordatorio
 * Idioma: Español (es)
 * Cuerpo:
 *   🙏 Recordatorio de Servicio
 *   ¡Hola, {{1}}! 👋
 *   Te recordamos que {{2}} te corresponde {{3}} en el culto:
 *   📋 Evento: {{4}}
 *   📅 Fecha: {{5}}
 *   📍 Lugar: {{6}}
 *   Por favor, prepárate con anticipación y llega puntual. 🕐
 *   ¡Que Dios te bendiga! 🙌
 * ─────────────────────────────────────────────
 * 
 * PARÁMETROS DEL TEMPLATE:
 *   {{1}} = Nombre del miembro (ej: "Daniel")
 *   {{2}} = "mañana" o "hoy"
 *   {{3}} = Rol: "Predicar", "Dirigir la adoración", "Cantar"
 *   {{4}} = Título del evento (ej: "Culto de Domingo")
 *   {{5}} = Fecha/hora formateada (ej: "Domingo 1 de Marzo, 2026 a las 9:35 AM")
 *   {{6}} = Ubicación (ej: "Iglesia Central") — si no hay, envía "Por confirmar"
 * 
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
 */

const https = require('https');

// =============================================
// ENVÍO DE MENSAJES POR WHATSAPP
// =============================================

/**
 * Limpia y normaliza un número de teléfono para la API de WhatsApp.
 * - Quita espacios, guiones, paréntesis, "+"
 * - Si no tiene código de país (≤8 dígitos), asume Panamá (+507)
 * 
 * @param {string} phone - Número original del miembro
 * @returns {string} Número normalizado (ej: "50760164352")
 */
function normalizePhone(phone) {
  const clean = phone.replace(/[\s\-\(\)\+]/g, '');
  // Si no tiene código de país, asumimos Panamá (+507)
  return clean.length <= 8 ? `507${clean}` : clean;
}

/**
 * Envía un payload JSON a la API de WhatsApp Business Cloud.
 * Función genérica usada tanto por sendWhatsAppTemplate como sendWhatsAppMessage.
 * 
 * @param {Object} payloadObj - Objeto con el payload completo de la API
 * @returns {Promise<Object>} { success: boolean, data/error }
 */
async function sendWhatsAppPayload(payloadObj) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn('[WHATSAPP] Variables WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configuradas.');
    return { success: false, error: 'WhatsApp no configurado' };
  }

  const payload = JSON.stringify(payloadObj);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v18.0/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[WHATSAPP] ✅ Mensaje enviado a ${payloadObj.to}`);
            resolve({ success: true, data: parsed });
          } else {
            console.error(`[WHATSAPP] ❌ Error ${res.statusCode} al enviar a ${payloadObj.to}:`, parsed);
            resolve({ success: false, error: parsed });
          }
        } catch (parseErr) {
          resolve({ success: false, error: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[WHATSAPP] ❌ Error de red al enviar a ${payloadObj.to}:`, err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Envía un mensaje de TEMPLATE por WhatsApp.
 * 
 * Los templates NO dependen de la ventana de 24h, por lo que se pueden
 * enviar en cualquier momento a cualquier número registrado.
 * 
 * @param {string} to - Número de teléfono (se normaliza automáticamente)
 * @param {string} templateName - Nombre del template en Meta (ej: 'culto_recordatorio')
 * @param {string} language - Código de idioma del template (ej: 'es')
 * @param {Array<string>} bodyParams - Parámetros del body del template [{{1}}, {{2}}, ...]
 * @returns {Promise<Object>} { success: boolean, data/error }
 */
async function sendWhatsAppTemplate(to, templateName, language, bodyParams) {
  const phoneWithCountry = normalizePhone(to);

  /**
   * Payload de la API de WhatsApp para enviar un template.
   * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
   */
  const payloadObj = {
    messaging_product: 'whatsapp',
    to: phoneWithCountry,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: [
        {
          type: 'body',
          parameters: bodyParams.map((text) => ({
            type: 'text',
            text: String(text),
          })),
        },
      ],
    },
  };

  console.log(`[WHATSAPP] 📤 Enviando template "${templateName}" a ${phoneWithCountry} con params:`, bodyParams);

  return sendWhatsAppPayload(payloadObj);
}

/**
 * Envía un mensaje de texto libre por WhatsApp (fallback).
 * 
 * NOTA: Este método SOLO funciona si el destinatario ha enviado un
 * mensaje al número de WhatsApp Business en las últimas 24 horas.
 * Para envíos proactivos, usar sendWhatsAppTemplate().
 * 
 * @param {string} to - Número de teléfono
 * @param {string} message - Texto del mensaje
 * @returns {Promise<Object>} { success: boolean, data/error }
 */
async function sendWhatsAppMessage(to, message) {
  const phoneWithCountry = normalizePhone(to);

  const payloadObj = {
    messaging_product: 'whatsapp',
    to: phoneWithCountry,
    type: 'text',
    text: { body: message },
  };

  return sendWhatsAppPayload(payloadObj);
}

// =============================================
// FORMATO DE FECHAS Y MENSAJES
// =============================================

/**
 * Formatea la fecha completa para mostrar en los mensajes.
 * Ejemplo: "Domingo 1 de Marzo, 2026 a las 9:35 AM"
 */
function formatEventDate(date) {
  const d = new Date(date);
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const dayName = days[d.getDay()];
  const dayNum = d.getDate();
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${dayName} ${dayNum} de ${monthName}, ${year} a las ${hours}:${minutes} ${ampm}`;
}

/**
 * Formatea solo la hora del evento.
 * Ejemplo: "7:00 PM"
 */
function formatEventTime(date) {
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Genera el mensaje de recordatorio con emojis (para logging/referencia).
 * 
 * Este mensaje es el "ideal" que queremos que el miembro reciba.
 * El contenido real depende del texto del template en Meta.
 * Se usa para:
 * 1. Logging en consola (ver qué se enviaría)
 * 2. Referencia para configurar el template en Meta
 * 
 * @param {string} memberName - Nombre del miembro
 * @param {string} role - Rol asignado
 * @param {Object} event - Evento con title, start_date, location
 * @param {string} type - 'reminder' (día anterior/previo) o 'today' (mismo día)
 * @param {string} churchName - Nombre de la iglesia
 * @param {number} daysAhead - Días de anticipación (1="mañana", 2+="en X días")
 * @returns {string} Mensaje formateado con emojis
 */
function buildReminderMessage(memberName, role, event, type, churchName, daysAhead = 1) {
  const dateStr = formatEventDate(event.start_date);
  const locationStr = event.location ? `📍 Lugar: ${event.location}` : '';
  // Generar palabra temporal según los días de anticipación configurados
  const timeWord = type === 'reminder'
    ? (daysAhead === 1 ? 'mañana' : `en ${daysAhead} días`)
    : 'hoy';

  if (type === 'reminder') {
    return [
      `🙏 Recordatorio de Servicio - ${churchName}`,
      ``,
      `¡Hola, ${memberName}! 👋`,
      ``,
      `Te recordamos que ${timeWord} te corresponde ${role} en el culto:`,
      ``,
      `📋 Evento: ${event.title}`,
      `📅 Fecha: ${dateStr}`,
      locationStr,
      ``,
      `Por favor, prepárate con anticipación y llega puntual. 🕐`,
      ``,
      `¡Que Dios te bendiga! 🙌`,
    ].filter(Boolean).join('\n');
  }

  // Recordatorio el mismo día
  return [
    `⛪ ¡Hoy es el día! - ${churchName}`,
    ``,
    `¡Hola, ${memberName}! 👋`,
    ``,
    `Te recordamos que hoy te corresponde ${role} en el culto:`,
    ``,
    `📋 Evento: ${event.title}`,
    `📅 Fecha: ${dateStr}`,
    locationStr,
    ``,
    `¡Te esperamos! Que el Señor use tu vida poderosamente hoy. 🔥`,
  ].filter(Boolean).join('\n');
}

// =============================================
// ENVÍO DE RECORDATORIOS DE CULTO
// =============================================

/**
 * Envía recordatorios de WhatsApp a los miembros asignados a un culto.
 * 
 * Usa el template de WhatsApp para enviar mensajes que NO dependen
 * de la ventana de 24h. Los parámetros del template son:
 * 
 *   {{1}} = Nombre del miembro          (ej: "Daniel")
 *   {{2}} = "mañana" o "hoy"
 *   {{3}} = Rol                          (ej: "Predicar")
 *   {{4}} = Título del evento            (ej: "Culto de Domingo")
 *   {{5}} = Fecha/hora formateada        (ej: "Domingo 1 de Marzo, 2026 a las 9:35 AM")
 *   {{6}} = Ubicación                    (ej: "Iglesia Central")
 * 
 * @param {Object} event - Evento con preacher, worship_leader, singer (objetos Member)
 * @param {string} type - 'reminder' (día anterior/previo) o 'today' (mismo día)
 * @param {string} churchName - Nombre de la iglesia
 * @param {number} daysAhead - Días de anticipación (1="mañana", 2+="en X días"). Solo aplica para type='reminder'.
 * @returns {Object} Resumen de envíos { sent, failed, skipped, details }
 */
async function sendCultoReminders(event, type, churchName, daysAhead = 1) {
  const results = { sent: 0, failed: 0, skipped: 0, details: [] };

  // Nombre del template y idioma (configurables por variable de entorno)
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'culto_recordatorio';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'es';

  // Palabra clave según tipo de recordatorio y días de anticipación
  // Si es recordatorio previo: "mañana" (1 día) o "en X días" (2+ días)
  const timeWord = type === 'reminder'
    ? (daysAhead === 1 ? 'mañana' : `en ${daysAhead} días`)
    : 'hoy';

  // Fecha formateada para el parámetro {{5}}
  const dateStr = formatEventDate(event.start_date);

  // Ubicación para el parámetro {{6}} (fallback si no hay)
  const locationStr = event.location || churchName || 'Por confirmar';

  /**
   * Mapa de roles de culto con su descripción en español.
   * Cada entrada: [campo del evento (objeto Member), verbo/rol para {{3}}]
   */
  const roles = [
    { member: event.preacher, role: 'Predicar' },
    { member: event.worship_leader, role: 'Dirigir la adoración' },
    { member: event.singer, role: 'Cantar (líder de cánticos)' },
  ];

  for (const { member, role } of roles) {
    if (!member) {
      results.skipped++;
      continue;
    }

    // Verificar que el miembro tenga teléfono registrado
    if (!member.phone) {
      console.warn(`[WHATSAPP] ⚠️ ${member.first_name} ${member.last_name} no tiene teléfono. Saltando.`);
      results.skipped++;
      results.details.push({
        member: `${member.first_name} ${member.last_name}`,
        role, status: 'sin_telefono',
      });
      continue;
    }

    /**
     * Construir los 6 parámetros del template:
     * {{1}} = Nombre         → member.first_name
     * {{2}} = Cuándo         → "mañana" o "hoy"
     * {{3}} = Rol            → "Predicar", "Dirigir la adoración", etc.
     * {{4}} = Evento         → event.title
     * {{5}} = Fecha/hora     → "Domingo 1 de Marzo, 2026 a las 9:35 AM"
     * {{6}} = Lugar          → event.location o churchName
     */
    const bodyParams = [
      member.first_name,     // {{1}} Nombre
      timeWord,              // {{2}} "mañana" / "hoy"
      role,                  // {{3}} Rol
      event.title,           // {{4}} Título del evento
      dateStr,               // {{5}} Fecha completa
      locationStr,           // {{6}} Ubicación
    ];

    // Log del mensaje ideal (con emojis) para referencia en consola
    const logMessage = buildReminderMessage(member.first_name, role, event, type, churchName, daysAhead);
    console.log(`[WHATSAPP] 📋 Mensaje para ${member.first_name} ${member.last_name}:\n${logMessage}\n`);

    // Enviar template por WhatsApp
    const result = await sendWhatsAppTemplate(
      member.phone,
      templateName,
      templateLang,
      bodyParams,
    );

    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
    }

    results.details.push({
      member: `${member.first_name} ${member.last_name}`,
      phone: member.phone,
      role,
      status: result.success ? 'enviado' : 'error',
      error: result.error || null,
    });
  }

  return results;
}

module.exports = {
  sendWhatsAppPayload,
  sendWhatsAppTemplate,
  sendWhatsAppMessage,
  sendCultoReminders,
  buildReminderMessage,
  formatEventDate,
  formatEventTime,
  normalizePhone,
};

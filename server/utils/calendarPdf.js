/**
 * calendarPdf.js - Generador de Calendario Mensual PDF
 * 
 * FUNCIONALIDADES:
 * - Soporte para eventos multi-día (2+ días)
 * - Roles de culto: muestra P:/D:/C: debajo del título para eventos tipo Culto
 * - Layout dinámico: la grilla se expande en alto según la cantidad de eventos
 *   en el día más cargado de cada semana
 * - Títulos completos de eventos (sin truncar)
 * 
 * Dependencia: pdfkit (npm install pdfkit)
 */
const PDFDocument = require('pdfkit');

// =============================================
// CONFIGURACIÓN DE COLORES Y ESTILOS
// =============================================

/** Colores de fondo para cada tipo de evento */
const EVENT_COLORS = {
  'Evangelismo':  { bg: '#E8F5E9', text: '#1B5E20', border: '#66BB6A' },
  'Culto':        { bg: '#E3F2FD', text: '#0D47A1', border: '#42A5F5' },
  'Reunión':      { bg: '#FFF3E0', text: '#E65100', border: '#FFA726' },
  'Jornada':      { bg: '#F3E5F5', text: '#4A148C', border: '#AB47BC' },
  'Conferencia':  { bg: '#FCE4EC', text: '#880E4F', border: '#EC407A' },
  'Campamento':   { bg: '#E0F7FA', text: '#006064', border: '#26C6DA' },
  'Ventas':       { bg: '#FFF8E1', text: '#F57F17', border: '#FFB300' },
  'Otro':         { bg: '#F5F5F5', text: '#424242', border: '#BDBDBD' },
};

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

// =============================================
// CONSTANTES DE LAYOUT
// =============================================

/**
 * Alturas de slot para eventos en el PDF:
 * - SLOT_NORMAL: evento sin roles de culto (2 líneas: hora + título)
 * - SLOT_CULTO:  evento con roles de culto (2 líneas + 3 roles: P, D, C)
 * 
 * Estos valores se usan para calcular la altura dinámica de cada fila.
 */
const SLOT_NORMAL = 22;
const SLOT_CULTO = 44;

/** Espacio reservado para el número del día en cada celda */
const DAY_NUMBER_HEIGHT = 17;

/** Margen inferior dentro de la celda */
const CELL_BOTTOM_MARGIN = 4;

// =============================================
// FUNCIONES AUXILIARES
// =============================================

function getCalendarGrid(year, month) {
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();

  const weeks = [];
  let currentWeek = new Array(7).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    currentWeek[dow] = day;
    if (dow === 6 || day === daysInMonth) {
      weeks.push([...currentWeek]);
      currentWeek = new Array(7).fill(null);
    }
  }
  return weeks;
}

function formatTime(date) {
  const d = new Date(date);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? text.substring(0, max - 1) + '…' : text;
}

/**
 * Extrae solo la parte de fecha (sin hora) para comparar días.
 * Esto evita problemas de zona horaria al segmentar por día.
 */
function toLocalDateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Expande un evento en "ocurrencias" por día para eventos multi-día.
 * 
 * Reglas:
 * - Mismo día: { label: "HH:MM-HH:MM", dayType: 'single' }
 * - Día 1 (inicio): { label: "HH:MM ▶", dayType: 'start' }
 * - Días intermedios: { label: "completo", dayType: 'middle' }
 * - Último día: { label: "▶ HH:MM", dayType: 'end' }
 * 
 * Ahora también incluye datos de roles de culto:
 * - preacher_name, worship_leader_name, singer_name (del eventController)
 * 
 * @param {Object} ev - Evento con start_date, end_date, title, event_type, roles
 * @param {number} year - Año del calendario
 * @param {number} month - Mes del calendario (1-12)
 * @returns {Array} Array de { day, label, title, event_type, dayType, sortTime, cultoRoles }
 */
function expandEventToDays(ev, year, month) {
  const start = new Date(ev.start_date);
  const end = ev.end_date ? new Date(ev.end_date) : start;

  // Extraer fechas sin hora para comparar días
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  // Si start y end son el mismo día
  const isSameDay = startDay.getTime() === endDay.getTime();

  /**
   * Construir array de roles de culto si es tipo Culto.
   * Solo se agregan los roles que tienen un miembro asignado.
   * Formato: [{ prefix: 'P', name: 'Moises' }, ...]
   */
  const cultoRoles = [];
  if (ev.event_type === 'Culto') {
    if (ev.preacher_name)        cultoRoles.push({ prefix: 'P', name: ev.preacher_name });
    if (ev.worship_leader_name)  cultoRoles.push({ prefix: 'D', name: ev.worship_leader_name });
    if (ev.singer_name)          cultoRoles.push({ prefix: 'C', name: ev.singer_name });
  }

  const occurrences = [];
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

  // Iterar cada día desde startDay hasta endDay
  let current = new Date(Math.max(startDay.getTime(), firstDayOfMonth.getTime()));
  const limit = new Date(Math.min(endDay.getTime(), lastDayOfMonth.getTime()));

  while (current <= limit) {
    const day = current.getDate();
    const isFirstDay = current.getTime() === startDay.getTime();
    const isLastDay = current.getTime() === endDay.getTime();

    let label, dayType, sortTime;

    if (isSameDay) {
      // Evento de un solo día: mostrar hora inicio-fin
      const startT = formatTime(start);
      const endT = ev.end_date ? `-${formatTime(end)}` : '';
      label = `${startT}${endT}`;
      dayType = 'single';
      sortTime = start.getHours() * 60 + start.getMinutes();
    } else if (isFirstDay) {
      // Primer día del evento multi-día
      label = `${formatTime(start)} ▶`;
      dayType = 'start';
      sortTime = start.getHours() * 60 + start.getMinutes();
    } else if (isLastDay) {
      // Último día del evento multi-día
      label = `▶ ${formatTime(end)}`;
      dayType = 'end';
      sortTime = 0; // Mostrar al inicio del día
    } else {
      // Día intermedio: todo el día
      label = 'completo';
      dayType = 'middle';
      sortTime = 0;
    }

    occurrences.push({
      day,
      label,
      title: ev.title,
      event_type: ev.event_type,
      dayType,
      sortTime,
      cultoRoles,  // Array de roles de culto (vacío si no es Culto)
    });

    // Avanzar al siguiente día
    current.setDate(current.getDate() + 1);
  }

  return occurrences;
}

/**
 * Calcula la altura (px) que necesita un evento en el PDF.
 * 
 * - Evento normal: SLOT_NORMAL (hora + título = 2 líneas)
 * - Evento Culto con roles: SLOT_CULTO (hora + título + hasta 3 roles)
 * 
 * @param {Object} occ - Ocurrencia del evento
 * @returns {number} Altura en puntos PDF
 */
function getSlotHeight(occ) {
  if (occ.cultoRoles && occ.cultoRoles.length > 0) {
    return SLOT_CULTO;
  }
  return SLOT_NORMAL;
}

/**
 * Calcula la altura total necesaria para un día dado.
 * Suma las alturas de todos los eventos + espacio del número de día + margen.
 * 
 * @param {Array} dayEvents - Eventos del día
 * @returns {number} Altura total en puntos PDF
 */
function getDayRequiredHeight(dayEvents) {
  if (!dayEvents || dayEvents.length === 0) {
    return DAY_NUMBER_HEIGHT + CELL_BOTTOM_MARGIN;
  }
  const eventsHeight = dayEvents.reduce((sum, occ) => sum + getSlotHeight(occ), 0);
  return DAY_NUMBER_HEIGHT + eventsHeight + CELL_BOTTOM_MARGIN;
}

// =============================================
// FUNCIÓN PRINCIPAL: GENERAR PDF
// =============================================

function generateCalendarPdf({ year, month, churchName, events }) {
  const doc = new PDFDocument({
    size: 'LETTER',
    layout: 'landscape',
    margins: { top: 30, bottom: 20, left: 25, right: 25 },
    info: {
      Title: `Calendario ${MONTH_NAMES[month - 1]} ${year} - ${churchName}`,
      Author: 'Gestión Cristiana TMDV',
      Subject: `Calendario de Eventos - ${MONTH_NAMES[month - 1]} ${year}`,
    },
  });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const startX = doc.page.margins.left;
  const startY = doc.page.margins.top;

  // =========================================
  // ENCABEZADO: Nombre iglesia + Mes/Año
  // =========================================
  doc.rect(startX, startY, pageWidth, 50).fill('#0D47A1');

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#FFFFFF')
     .text(churchName || 'Gestión Cristiana TMDV', startX + 15, startY + 8, {
       width: pageWidth * 0.6, align: 'left',
     });

  doc.font('Helvetica').fontSize(9).fillColor('#B3D4FC')
     .text('Calendario de Eventos', startX + 15, startY + 28, {
       width: pageWidth * 0.6, align: 'left',
     });

  doc.font('Helvetica-Bold').fontSize(26).fillColor('#FFFFFF')
     .text(MONTH_NAMES[month - 1], startX + pageWidth * 0.55, startY + 3, {
       width: pageWidth * 0.4, align: 'right',
     });

  doc.font('Helvetica').fontSize(14).fillColor('#B3D4FC')
     .text(year.toString(), startX + pageWidth * 0.55, startY + 32, {
       width: pageWidth * 0.4, align: 'right',
     });

  // =========================================
  // ENCABEZADO DE DÍAS (Dom-Sáb)
  // =========================================
  const headerY = startY + 55;
  const colWidth = pageWidth / 7;
  const dayHeaderH = 22;

  DAY_NAMES.forEach((dayName, i) => {
    const x = startX + (i * colWidth);
    const bgColor = i === 0 ? '#1565C0' : '#1E88E5';
    doc.rect(x, headerY, colWidth, dayHeaderH).fill(bgColor);
    if (i < 6) {
      doc.rect(x + colWidth - 0.5, headerY, 0.5, dayHeaderH).fill('#0D47A1');
    }
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
       .text(dayName, x, headerY + 6, { width: colWidth, align: 'center' });
  });

  // =========================================
  // EXPANDIR EVENTOS MULTI-DÍA
  // =========================================
  const eventsByDay = {};
  events.forEach((ev) => {
    const occurrences = expandEventToDays(ev, year, month);
    occurrences.forEach((occ) => {
      if (!eventsByDay[occ.day]) eventsByDay[occ.day] = [];
      eventsByDay[occ.day].push(occ);
    });
  });

  // Ordenar eventos dentro de cada día por sortTime
  Object.keys(eventsByDay).forEach((day) => {
    eventsByDay[day].sort((a, b) => a.sortTime - b.sortTime);
  });

  // =========================================
  // GRILLA DEL CALENDARIO CON ALTURAS DINÁMICAS
  // =========================================
  const gridStartY = headerY + dayHeaderH;
  const weeks = getCalendarGrid(year, month);
  const totalWeeks = weeks.length;

  /**
   * CÁLCULO DINÁMICO DE ALTURAS POR SEMANA:
   * Para cada semana, se calcula la altura necesaria basándose en el día
   * más cargado de esa semana. Esto permite que las filas se expandan
   * cuando hay muchos eventos o eventos con roles de culto.
   */
  const availableHeight = pageHeight - (gridStartY - startY) - 25; // 25 = footer
  const minRowHeight = 55; // Mínimo para que siempre se vea el número del día

  // 1. Calcular la altura ideal de cada semana
  const weekHeights = weeks.map((week) => {
    let maxDayHeight = minRowHeight;
    week.forEach((day) => {
      if (day === null) return;
      const dayEvts = eventsByDay[day] || [];
      const needed = getDayRequiredHeight(dayEvts);
      if (needed > maxDayHeight) maxDayHeight = needed;
    });
    return maxDayHeight;
  });

  // 2. Escalar las alturas para que quepan en la página
  const totalIdeal = weekHeights.reduce((sum, h) => sum + h, 0);
  const scaleFactor = totalIdeal > availableHeight ? availableHeight / totalIdeal : 1;
  const scaledHeights = weekHeights.map((h) => Math.max(h * scaleFactor, minRowHeight));

  // =========================================
  // DIBUJAR CELDAS Y EVENTOS
  // =========================================
  let currentRowY = gridStartY;

  weeks.forEach((week, weekIndex) => {
    const rowHeight = scaledHeights[weekIndex];

    week.forEach((day, colIndex) => {
      const cellX = startX + (colIndex * colWidth);

      // Fondo de la celda
      const isWeekend = colIndex === 0 || colIndex === 6;
      const bgColor = day === null ? '#F0F0F0' : (isWeekend ? '#F5F8FF' : '#FFFFFF');
      doc.rect(cellX, currentRowY, colWidth, rowHeight).fill(bgColor);

      // Bordes
      doc.rect(cellX, currentRowY, colWidth, rowHeight)
         .strokeColor('#CCCCCC').lineWidth(0.5).stroke();

      if (day === null) return;

      // Número del día
      doc.font('Helvetica-Bold').fontSize(11)
         .fillColor(colIndex === 0 ? '#C62828' : '#333333')
         .text(day.toString(), cellX + 4, currentRowY + 3);

      // Eventos del día (expandidos)
      const dayEvents = eventsByDay[day] || [];
      if (dayEvents.length === 0) return;

      let evY = currentRowY + DAY_NUMBER_HEIGHT;

      dayEvents.forEach((occ) => {
        const slotH = getSlotHeight(occ);
        const colors = EVENT_COLORS[occ.event_type] || EVENT_COLORS['Otro'];

        // Verificar que no nos salgamos de la celda
        if (evY + slotH > currentRowY + rowHeight) return;

        // Fondo del evento (alto dinámico según tipo)
        doc.roundedRect(cellX + 2, evY, colWidth - 4, slotH - 2, 2).fill(colors.bg);

        // Línea izquierda de color (accent). Doble barra para multi-día
        if (occ.dayType === 'middle') {
          doc.rect(cellX + 2, evY, 2.5, slotH - 2).fill(colors.border);
          doc.rect(cellX + 5, evY, 1, slotH - 2).fill(colors.border);
        } else {
          doc.rect(cellX + 2, evY, 2.5, slotH - 2).fill(colors.border);
        }

        // Línea 1: Label de hora/estado (bold, 5pt)
        doc.font('Helvetica-Bold').fontSize(5).fillColor(colors.text)
           .text(occ.label, cellX + 7, evY + 1.5, {
             width: colWidth - 12, lineBreak: false,
           });

        // Línea 2: Título COMPLETO del evento (sin truncar, 5.5pt)
        doc.font('Helvetica').fontSize(5.5).fillColor(colors.text)
           .text(occ.title, cellX + 7, evY + 9, {
             width: colWidth - 12, lineBreak: false,
           });

        /**
         * ROLES DE CULTO (P, D, C):
         * Si el evento es tipo Culto y tiene roles asignados,
         * mostrar cada rol en una línea debajo del título.
         * 
         * NOTA: No usar continued:true — PDFKit tiene bugs al combinar
         * fonts con continued. En su lugar, renderizamos cada rol
         * como un string completo "P: Moises" en una sola llamada .text().
         */
        if (occ.cultoRoles && occ.cultoRoles.length > 0) {
          let roleY = evY + 17; // Debajo del título
          occ.cultoRoles.forEach((role) => {
            // Línea completa: "P: Moises" en bold para que sea legible
            doc.font('Helvetica-Bold').fontSize(6).fillColor('#1A237E')
               .text(`${role.prefix}: ${role.name}`, cellX + 7, roleY, {
                 width: colWidth - 12, lineBreak: false,
               });
            roleY += 7; // Siguiente línea de rol
          });
        }

        evY += slotH; // Avanzar al siguiente slot
      });
    });

    currentRowY += rowHeight; // Avanzar a la siguiente fila/semana
  });

  // =========================================
  // PIE DE PÁGINA: Leyenda
  // =========================================
  const footerY = currentRowY + 6;

  doc.font('Helvetica').fontSize(7).fillColor('#666666')
     .text('Leyenda:', startX, footerY);

  let legendX = startX + 45;
  Object.entries(EVENT_COLORS).forEach(([type, colors]) => {
    doc.roundedRect(legendX, footerY - 1, 8, 8, 1).fill(colors.border);
    doc.font('Helvetica').fontSize(6.5).fillColor('#555')
       .text(type, legendX + 11, footerY, { lineBreak: false });
    legendX += type.length * 4.5 + 20;
  });

  // Leyenda de roles de culto
  doc.font('Helvetica').fontSize(6.5).fillColor('#555')
     .text('| P: Predica  D: Dirige  C: Canta', legendX + 5, footerY, { lineBreak: false });

  const now = new Date();
  const genDate = now.toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  doc.font('Helvetica').fontSize(6.5).fillColor('#999')
     .text(`Generado: ${genDate}`, startX, footerY + 10, {
       width: pageWidth, align: 'right',
     });

  doc.end();
  return doc;
}

module.exports = { generateCalendarPdf };

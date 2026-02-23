/**
 * calendarPdf.js - Generador de Calendario Mensual PDF
 * 
 * MEJORAS:
 * - Soporte para eventos multi-día (2+ días):
 *   Día 1: título + hora inicio
 *   Días intermedios: título + "completo"
 *   Último día: título + hora fin
 * - Eventos de un solo día se muestran con hora inicio-fin
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
  'Otro':         { bg: '#F5F5F5', text: '#424242', border: '#BDBDBD' },
};

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

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
 * @param {Object} ev - Evento con start_date, end_date, title, event_type
 * @param {number} year - Año del calendario
 * @param {number} month - Mes del calendario (1-12)
 * @returns {Array} Array de { day, label, title, event_type, dayType, sortTime }
 */
function expandEventToDays(ev, year, month) {
  const start = new Date(ev.start_date);
  const end = ev.end_date ? new Date(ev.end_date) : start;

  // Extraer fechas sin hora para comparar días
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  // Si start y end son el mismo día
  const isSameDay = startDay.getTime() === endDay.getTime();

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
    });

    // Avanzar al siguiente día
    current.setDate(current.getDate() + 1);
  }

  return occurrences;
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
  // GRILLA DEL CALENDARIO
  // =========================================
  const gridStartY = headerY + dayHeaderH;
  const weeks = getCalendarGrid(year, month);
  const totalWeeks = weeks.length;

  const availableHeight = pageHeight - (gridStartY - startY) - 10;
  const rowHeight = Math.min(availableHeight / totalWeeks, 105);

  weeks.forEach((week, weekIndex) => {
    const rowY = gridStartY + (weekIndex * rowHeight);

    week.forEach((day, colIndex) => {
      const cellX = startX + (colIndex * colWidth);

      // Fondo de la celda
      const isWeekend = colIndex === 0 || colIndex === 6;
      const bgColor = day === null ? '#F0F0F0' : (isWeekend ? '#F5F8FF' : '#FFFFFF');
      doc.rect(cellX, rowY, colWidth, rowHeight).fill(bgColor);

      // Bordes
      doc.rect(cellX, rowY, colWidth, rowHeight)
         .strokeColor('#CCCCCC').lineWidth(0.5).stroke();

      if (day === null) return;

      // Número del día
      doc.font('Helvetica-Bold').fontSize(11)
         .fillColor(colIndex === 0 ? '#C62828' : '#333333')
         .text(day.toString(), cellX + 4, rowY + 3);

      // Eventos del día (expandidos)
      const dayEvents = eventsByDay[day] || [];
      if (dayEvents.length === 0) return;

      const evStartY = rowY + 17;
      /**
       * LAYOUT DE EVENTOS EN 2 LÍNEAS:
       * Línea 1: hora/estado (bold, pequeño)
       * Línea 2: título COMPLETO del evento (sin truncar)
       *
       * Esto permite ver el nombre entero del evento sin puntos suspensivos.
       * Cada slot de evento ocupa 22px (antes 13px con título truncado).
       */
      const eventSlotHeight = 22;
      const maxEvents = Math.floor((rowHeight - 20) / eventSlotHeight);
      const eventsToShow = dayEvents.slice(0, maxEvents);
      const remaining = dayEvents.length - eventsToShow.length;

      eventsToShow.forEach((occ, evIndex) => {
        const evY = evStartY + (evIndex * eventSlotHeight);
        const colors = EVENT_COLORS[occ.event_type] || EVENT_COLORS['Otro'];

        // Fondo del evento (ahora más alto para 2 líneas)
        doc.roundedRect(cellX + 2, evY, colWidth - 4, eventSlotHeight - 2, 2).fill(colors.bg);

        // Línea izquierda de color (accent). Doble barra para multi-día
        if (occ.dayType === 'middle') {
          doc.rect(cellX + 2, evY, 2.5, eventSlotHeight - 2).fill(colors.border);
          doc.rect(cellX + 5, evY, 1, eventSlotHeight - 2).fill(colors.border);
        } else {
          doc.rect(cellX + 2, evY, 2.5, eventSlotHeight - 2).fill(colors.border);
        }

        // Línea 1: Label de hora/estado (bold)
        doc.font('Helvetica-Bold').fontSize(5).fillColor(colors.text)
           .text(occ.label, cellX + 7, evY + 1.5, {
             width: colWidth - 12, lineBreak: false,
           });

        // Línea 2: Título COMPLETO del evento (sin truncar)
        doc.font('Helvetica').fontSize(5.5).fillColor(colors.text)
           .text(occ.title, cellX + 7, evY + 9, {
             width: colWidth - 12, lineBreak: false,
           });
      });

      if (remaining > 0) {
        const moreY = evStartY + (eventsToShow.length * eventSlotHeight);
        doc.font('Helvetica-Bold').fontSize(6).fillColor('#666666')
           .text(`+${remaining} más...`, cellX + 4, moreY + 1, {
             width: colWidth - 8, align: 'center',
           });
      }
    });
  });

  // =========================================
  // PIE DE PÁGINA: Leyenda
  // =========================================
  const footerY = gridStartY + (totalWeeks * rowHeight) + 8;

  doc.font('Helvetica').fontSize(7).fillColor('#666666')
     .text('Leyenda:', startX, footerY);

  let legendX = startX + 45;
  Object.entries(EVENT_COLORS).forEach(([type, colors]) => {
    doc.roundedRect(legendX, footerY - 1, 8, 8, 1).fill(colors.border);
    doc.font('Helvetica').fontSize(6.5).fillColor('#555')
       .text(type, legendX + 11, footerY, { lineBreak: false });
    legendX += type.length * 4.5 + 20;
  });

  const now = new Date();
  const genDate = now.toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  doc.font('Helvetica').fontSize(6.5).fillColor('#999')
     .text(`Generado: ${genDate}`, startX, footerY, {
       width: pageWidth, align: 'right',
     });

  doc.end();
  return doc;
}

module.exports = { generateCalendarPdf };

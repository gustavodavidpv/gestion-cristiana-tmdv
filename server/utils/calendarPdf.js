/**
 * calendarPdf.js - Generador de Calendario Mensual PDF
 * 
 * Genera un PDF en formato paisaje (landscape) con un calendario
 * mensual que muestra los eventos registrados en cada día.
 * 
 * Estilo similar a un calendario impreso:
 * - Encabezado con nombre de iglesia, mes y año
 * - Grilla de 7 columnas (Dom-Sáb) x semanas del mes
 * - Cada celda muestra: número del día + eventos con hora y título
 * - Colores por tipo de evento
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
  'Retiro':       { bg: '#E0F7FA', text: '#006064', border: '#26C6DA' },
  'Otro':         { bg: '#F5F5F5', text: '#424242', border: '#BDBDBD' },
};

/** Nombres de los días (Domingo primero) */
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Nombres de los meses en español */
const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

// =============================================
// FUNCIONES AUXILIARES
// =============================================

/**
 * Obtiene los datos de la grilla del calendario para un mes dado.
 * Retorna un array de semanas, donde cada semana tiene 7 slots (Dom-Sáb).
 * 
 * @param {number} year - Año (ej: 2026)
 * @param {number} month - Mes (1-12)
 * @returns {Array} Array de semanas [{day: number|null}, ...]
 */
function getCalendarGrid(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // Último día del mes
  const daysInMonth = lastDay.getDate();
  const startDow = firstDay.getDay(); // 0=Dom, 1=Lun, etc. (perfecto, domingo primero)

  const weeks = [];
  let currentWeek = new Array(7).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    currentWeek[dow] = day;

    // Si es sábado (6) o último día del mes, cerrar semana
    if (dow === 6 || day === daysInMonth) {
      weeks.push([...currentWeek]);
      currentWeek = new Array(7).fill(null);
    }
  }

  return weeks;
}

/**
 * Formatea una hora de un Date a "HH:MM"
 * @param {Date|string} date 
 * @returns {string} "HH:MM"
 */
function formatTime(date) {
  const d = new Date(date);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Trunca un texto si excede el máximo de caracteres
 * @param {string} text 
 * @param {number} max 
 * @returns {string}
 */
function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? text.substring(0, max - 1) + '…' : text;
}

// =============================================
// FUNCIÓN PRINCIPAL: GENERAR PDF
// =============================================

/**
 * Genera un PDF de calendario mensual con los eventos.
 * 
 * @param {Object} options
 * @param {number} options.year - Año
 * @param {number} options.month - Mes (1-12)
 * @param {string} options.churchName - Nombre de la iglesia
 * @param {Array} options.events - Array de eventos del mes
 *   Cada evento: { title, event_type, start_date, end_date, location }
 * @returns {PDFDocument} Stream del PDF generado
 */
function generateCalendarPdf({ year, month, churchName, events }) {
  // Crear documento en landscape (Letter 11x8.5")
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

  // Fondo del encabezado
  doc.rect(startX, startY, pageWidth, 50)
     .fill('#0D47A1');

  // Nombre de la iglesia (izquierda)
  doc.font('Helvetica-Bold')
     .fontSize(14)
     .fillColor('#FFFFFF')
     .text(churchName || 'Gestión Cristiana TMDV', startX + 15, startY + 8, {
       width: pageWidth * 0.6,
       align: 'left',
     });

  // Subtítulo
  doc.font('Helvetica')
     .fontSize(9)
     .fillColor('#B3D4FC')
     .text('Calendario de Eventos', startX + 15, startY + 28, {
       width: pageWidth * 0.6,
       align: 'left',
     });

  // Mes y Año (derecha, grande)
  doc.font('Helvetica-Bold')
     .fontSize(26)
     .fillColor('#FFFFFF')
     .text(MONTH_NAMES[month - 1], startX + pageWidth * 0.55, startY + 3, {
       width: pageWidth * 0.4,
       align: 'right',
     });

  doc.font('Helvetica')
     .fontSize(14)
     .fillColor('#B3D4FC')
     .text(year.toString(), startX + pageWidth * 0.55, startY + 32, {
       width: pageWidth * 0.4,
       align: 'right',
     });

  // =========================================
  // ENCABEZADO DE DÍAS (Dom-Sáb)
  // =========================================
  const headerY = startY + 55;
  const colWidth = pageWidth / 7;
  const dayHeaderH = 22;

  DAY_NAMES.forEach((dayName, i) => {
    const x = startX + (i * colWidth);

    // Fondo del día (domingo en color distinto)
    const bgColor = i === 0 ? '#1565C0' : '#1E88E5';
    doc.rect(x, headerY, colWidth, dayHeaderH).fill(bgColor);

    // Borde derecho
    if (i < 6) {
      doc.rect(x + colWidth - 0.5, headerY, 0.5, dayHeaderH).fill('#0D47A1');
    }

    // Texto del día
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#FFFFFF')
       .text(dayName, x, headerY + 6, { width: colWidth, align: 'center' });
  });

  // =========================================
  // GRILLA DEL CALENDARIO
  // =========================================
  const gridStartY = headerY + dayHeaderH;
  const weeks = getCalendarGrid(year, month);
  const totalWeeks = weeks.length;

  // Calcular la altura disponible para las filas
  const availableHeight = pageHeight - (gridStartY - startY) - 10;
  const rowHeight = Math.min(availableHeight / totalWeeks, 105); // Máximo 105px por fila

  // Organizar eventos por día del mes
  const eventsByDay = {};
  events.forEach((ev) => {
    const d = new Date(ev.start_date);
    // Verificar que el evento pertenece al mes solicitado
    if (d.getFullYear() === year && (d.getMonth() + 1) === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(ev);
    }
  });

  // Dibujar cada semana (fila)
  weeks.forEach((week, weekIndex) => {
    const rowY = gridStartY + (weekIndex * rowHeight);

    // Dibujar cada día (celda)
    week.forEach((day, colIndex) => {
      const cellX = startX + (colIndex * colWidth);

      // Fondo de la celda
      const isWeekend = colIndex === 0 || colIndex === 6;
      const bgColor = day === null ? '#F0F0F0' : (isWeekend ? '#F5F8FF' : '#FFFFFF');
      doc.rect(cellX, rowY, colWidth, rowHeight).fill(bgColor);

      // Bordes de la celda
      doc.rect(cellX, rowY, colWidth, rowHeight)
         .strokeColor('#CCCCCC')
         .lineWidth(0.5)
         .stroke();

      if (day === null) return; // Celda vacía (día fuera del mes)

      // Número del día (esquina superior izquierda)
      const isToday = false; // No verificamos "hoy" porque es PDF estático
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(colIndex === 0 ? '#C62828' : '#333333') // Domingos en rojo
         .text(day.toString(), cellX + 4, rowY + 3);

      // =========================================
      // EVENTOS DEL DÍA
      // =========================================
      const dayEvents = eventsByDay[day] || [];
      if (dayEvents.length === 0) return;

      // Ordenar eventos por hora de inicio
      dayEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

      const evStartY = rowY + 17; // Debajo del número del día
      const maxEvents = Math.floor((rowHeight - 20) / 13); // Cuántos eventos caben
      const eventsToShow = dayEvents.slice(0, maxEvents);
      const remaining = dayEvents.length - eventsToShow.length;

      eventsToShow.forEach((ev, evIndex) => {
        const evY = evStartY + (evIndex * 13);
        const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS['Otro'];

        // Fondo del evento (pequeño rectángulo)
        doc.roundedRect(cellX + 2, evY, colWidth - 4, 12, 2)
           .fill(colors.bg);

        // Línea izquierda de color (accent)
        doc.rect(cellX + 2, evY, 2.5, 12)
           .fill(colors.border);

        // Hora de inicio
        const timeStr = formatTime(ev.start_date);
        doc.font('Helvetica-Bold')
           .fontSize(6)
           .fillColor(colors.text)
           .text(timeStr, cellX + 6, evY + 1.5, { width: 26 });

        // Título del evento (truncado para caber)
        const maxTitleChars = Math.floor((colWidth - 40) / 3.5);
        const title = truncate(ev.title, maxTitleChars);
        doc.font('Helvetica')
           .fontSize(6)
           .fillColor(colors.text)
           .text(title, cellX + 32, evY + 1.5, {
             width: colWidth - 36,
             lineBreak: false,
           });
      });

      // Si hay más eventos que no caben, mostrar "+N más"
      if (remaining > 0) {
        const moreY = evStartY + (eventsToShow.length * 13);
        doc.font('Helvetica-Bold')
           .fontSize(6)
           .fillColor('#666666')
           .text(`+${remaining} más...`, cellX + 4, moreY + 1, {
             width: colWidth - 8,
             align: 'center',
           });
      }
    });
  });

  // =========================================
  // PIE DE PÁGINA
  // =========================================
  const footerY = gridStartY + (totalWeeks * rowHeight) + 8;

  // Leyenda de colores
  doc.font('Helvetica')
     .fontSize(7)
     .fillColor('#666666')
     .text('Leyenda:', startX, footerY);

  let legendX = startX + 45;
  Object.entries(EVENT_COLORS).forEach(([type, colors]) => {
    // Rectángulo de color
    doc.roundedRect(legendX, footerY - 1, 8, 8, 1).fill(colors.border);
    // Texto
    doc.font('Helvetica')
       .fontSize(6.5)
       .fillColor('#555')
       .text(type, legendX + 11, footerY, { lineBreak: false });
    legendX += type.length * 4.5 + 20;
  });

  // Fecha de generación (derecha)
  const now = new Date();
  const genDate = now.toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  doc.font('Helvetica')
     .fontSize(6.5)
     .fillColor('#999')
     .text(`Generado: ${genDate}`, startX, footerY, {
       width: pageWidth,
       align: 'right',
     });

  // Finalizar el documento
  doc.end();
  return doc;
}

module.exports = { generateCalendarPdf };

/**
 * salesCalendarPdf.js - Generador de Calendario de Ventas PDF (Multi-Mes)
 * 
 * DISEÑO basado en imagen de referencia:
 * - Orientación horizontal (landscape), tamaño carta
 * - Título grande: "CALENDARIO DE VENTAS {AÑO}"
 * - Columnas por mes (solo meses que tienen eventos de tipo Ventas)
 * - Cada celda muestra: número del día (grande), título del evento (bold),
 *   y día de la semana (pequeño debajo)
 * - Colores alternados para encabezados de mes
 * - Grilla con bordes
 * 
 * Dependencia: pdfkit (npm install pdfkit)
 */
const PDFDocument = require('pdfkit');

// =============================================
// CONFIGURACIÓN
// =============================================

const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

const DAY_NAMES = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

/**
 * Colores para los encabezados de cada mes (se repiten cíclicamente).
 * Inspirados en la imagen de referencia.
 */
const MONTH_HEADER_COLORS = [
  '#0D47A1', // Azul oscuro
  '#1565C0', // Azul medio
  '#D32F2F', // Rojo
  '#0D47A1', // Azul oscuro
  '#1976D2', // Azul
  '#F9A825', // Amarillo dorado
  '#0D47A1', // Azul oscuro
  '#2E7D32', // Verde
  '#6A1B9A', // Púrpura
  '#E65100', // Naranja
  '#00838F', // Teal
  '#AD1457', // Rosa oscuro
];

// =============================================
// FUNCIÓN PRINCIPAL
// =============================================

/**
 * Genera el PDF del Calendario de Ventas para un año completo.
 * 
 * @param {Object} options
 * @param {number} options.year - Año del calendario
 * @param {string} options.churchName - Nombre de la iglesia
 * @param {Array}  options.events - Eventos de tipo "Ventas" con start_date, title
 * @returns {PDFDocument} Documento PDF (pipe a response)
 */
function generateSalesCalendarPdf({ year, churchName, events }) {
  const doc = new PDFDocument({
    size: 'LETTER',
    layout: 'landscape',
    margins: { top: 25, bottom: 20, left: 25, right: 25 },
    info: {
      Title: `Calendario de Ventas ${year} - ${churchName}`,
      Author: 'Gestión Cristiana TMDV',
      Subject: `Calendario de Ventas ${year}`,
    },
  });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const startX = doc.page.margins.left;
  const startY = doc.page.margins.top;

  // =========================================
  // ORGANIZAR EVENTOS POR MES
  // =========================================

  /**
   * Agrupa los eventos de Ventas por mes.
   * Cada mes contiene un array de { day, dayName, title }
   * ordenado por día del mes.
   */
  const eventsByMonth = {};
  events.forEach((ev) => {
    const d = new Date(ev.start_date);
    const monthIdx = d.getMonth(); // 0-11
    if (!eventsByMonth[monthIdx]) eventsByMonth[monthIdx] = [];
    eventsByMonth[monthIdx].push({
      day: d.getDate(),
      dayName: DAY_NAMES[d.getDay()],
      title: ev.title || 'Ventas',
    });
  });

  // Ordenar eventos dentro de cada mes por día
  Object.keys(eventsByMonth).forEach((m) => {
    eventsByMonth[m].sort((a, b) => a.day - b.day);
  });

  // Solo meses que tienen eventos (para no dibujar columnas vacías)
  const activeMonths = Object.keys(eventsByMonth)
    .map(Number)
    .sort((a, b) => a - b);

  // Si no hay eventos de ventas, generar PDF con mensaje
  if (activeMonths.length === 0) {
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#0D47A1')
       .text(`CALENDARIO DE VENTAS ${year}`, startX, startY + 20, {
         width: pageWidth, align: 'center',
       });
    doc.font('Helvetica').fontSize(14).fillColor('#666666')
       .text('No hay eventos de tipo "Ventas" registrados para este año.', startX, startY + 80, {
         width: pageWidth, align: 'center',
       });
    doc.end();
    return doc;
  }

  // =========================================
  // ENCABEZADO: Título + Nombre iglesia
  // =========================================
  const headerH = 55;

  // Fondo del título
  doc.rect(startX, startY, pageWidth, headerH).fill('#0D47A1');

  // Título principal
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#FFFFFF')
     .text(`CALENDARIO DE VENTAS ${year}`, startX + 15, startY + 8, {
       width: pageWidth * 0.7, align: 'left',
     });

  // Nombre de la iglesia (derecha, simula el logo)
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFFFFF')
     .text(churchName || 'Gestión Cristiana TMDV', startX + pageWidth * 0.55, startY + 8, {
       width: pageWidth * 0.42, align: 'right',
     });

  doc.font('Helvetica').fontSize(8).fillColor('#B3D4FC')
     .text('Templo Manantial de Vida', startX + pageWidth * 0.55, startY + 28, {
       width: pageWidth * 0.42, align: 'right',
     });

  // =========================================
  // CALCULAR DIMENSIONES DE LA GRILLA
  // =========================================
  const gridStartY = startY + headerH + 5;
  const monthHeaderH = 26;  // Altura del encabezado de cada mes

  const numCols = activeMonths.length;
  const colWidth = pageWidth / numCols;

  // Calcular la fila más alta (mes con más eventos)
  const maxEvents = Math.max(...activeMonths.map((m) => eventsByMonth[m].length));

  // Cada celda de evento tiene: número grande + título + día de semana
  const cellH = 48;  // Altura por celda de evento
  const gridContentH = maxEvents * cellH;

  // Altura disponible para la grilla (dejar espacio para footer)
  const availableH = pageHeight - (gridStartY - startY) - 30;
  const scaledCellH = gridContentH > availableH
    ? (availableH - monthHeaderH) / maxEvents
    : cellH;

  // =========================================
  // DIBUJAR ENCABEZADOS DE MES
  // =========================================
  activeMonths.forEach((monthIdx, colIdx) => {
    const x = startX + (colIdx * colWidth);
    const color = MONTH_HEADER_COLORS[monthIdx % MONTH_HEADER_COLORS.length];

    // Fondo del encabezado del mes
    doc.rect(x, gridStartY, colWidth, monthHeaderH).fill(color);

    // Borde derecho para separar columnas
    if (colIdx < numCols - 1) {
      doc.rect(x + colWidth - 0.5, gridStartY, 0.5, monthHeaderH).fill('#FFFFFF');
    }

    // Nombre del mes
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF')
       .text(MONTH_NAMES[monthIdx], x, gridStartY + 6, {
         width: colWidth, align: 'center',
       });
  });

  // =========================================
  // DIBUJAR CELDAS DE EVENTOS
  // =========================================
  const cellStartY = gridStartY + monthHeaderH;

  activeMonths.forEach((monthIdx, colIdx) => {
    const x = startX + (colIdx * colWidth);
    const monthEvents = eventsByMonth[monthIdx];

    monthEvents.forEach((ev, rowIdx) => {
      const y = cellStartY + (rowIdx * scaledCellH);

      // Fondo de la celda (alternancia de colores para legibilidad)
      const bgColor = rowIdx % 2 === 0 ? '#FFFFFF' : '#F5F8FF';
      doc.rect(x, y, colWidth, scaledCellH).fill(bgColor);

      // Bordes de la celda
      doc.rect(x, y, colWidth, scaledCellH)
         .strokeColor('#CCCCCC').lineWidth(0.5).stroke();

      /**
       * Contenido de la celda:
       * - Número del día: grande y bold (estilo poster)
       * - Título del evento: bold, al lado del número
       * - Día de la semana: pequeño, debajo del número
       */

      // Número del día (grande, bold, alineado a la izquierda)
      const dayStr = ev.day.toString().padStart(2, '0');
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#0D47A1')
         .text(dayStr, x + 6, y + 4, {
           width: 38, lineBreak: false,
         });

      // Título del evento (bold, a la derecha del número)
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1A237E')
         .text(ev.title.toUpperCase(), x + 44, y + 8, {
           width: colWidth - 52, lineBreak: false,
         });

      // Día de la semana (pequeño, debajo del número)
      doc.font('Helvetica').fontSize(7).fillColor('#666666')
         .text(ev.dayName, x + 8, y + 28, {
           width: colWidth - 16, lineBreak: false,
         });
    });

    // Si este mes tiene menos eventos que el máximo, rellenar celdas vacías
    for (let rowIdx = monthEvents.length; rowIdx < maxEvents; rowIdx++) {
      const y = cellStartY + (rowIdx * scaledCellH);
      doc.rect(x, y, colWidth, scaledCellH).fill('#F0F0F0');
      doc.rect(x, y, colWidth, scaledCellH)
         .strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    }
  });

  // =========================================
  // BORDE EXTERIOR DE LA GRILLA
  // =========================================
  const totalGridH = monthHeaderH + (maxEvents * scaledCellH);
  doc.rect(startX, gridStartY, pageWidth, totalGridH)
     .strokeColor('#0D47A1').lineWidth(1.5).stroke();

  // =========================================
  // PIE DE PÁGINA
  // =========================================
  const footerY = gridStartY + totalGridH + 8;

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#C62828')
     .text('IMPORTANTE: ANUNCIAR CON TIEMPO EL DÍA QUE NO HARÁN VENTA PARA CEDER EL ESPACIO A OTRO GRUPO',
       startX, footerY, { width: pageWidth, align: 'center' });

  // Fecha de generación
  const now = new Date();
  const genDate = now.toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  doc.font('Helvetica').fontSize(6.5).fillColor('#999')
     .text(`Generado: ${genDate}`, startX, footerY + 14, {
       width: pageWidth, align: 'right',
     });

  doc.end();
  return doc;
}

module.exports = { generateSalesCalendarPdf };

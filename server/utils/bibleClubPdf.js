/**
 * bibleClubPdf.js - Tabla de posiciones del Club Bíblico en PDF
 *
 * Pensado para imprimirlo y presentárselo a los muchachos: la hoja está
 * armada como la tabla de posiciones de una liga de fútbol.
 *
 * ESTRUCTURA:
 *   - Cabecera tipo cancha (césped con franjas de corte + balón)
 *   - Franja de datos de la jornada (jugadores, puntos en juego, líder)
 *   - Podio de los tres primeros con camisetas dorsales
 *   - Tabla de posiciones con barra de avance respecto al líder
 *   - Pie con leyenda de niveles y espacio para firma de entrega
 *
 * Todo se dibuja con vectores (nada de emojis: las fuentes estándar de
 * PDF no los soportan y saldrían como cuadros).
 *
 * Dependencia: pdfkit
 */
const PDFDocument = require('pdfkit');

// =============================================
// PALETA
// =============================================
const COLORS = {
  grass: '#1B5E20',
  grassLight: '#2E7D32',
  grassStripe: '#256B2A',
  gold: '#F9A825',
  silver: '#78909C',
  bronze: '#A1887F',
  ink: '#212121',
  muted: '#757575',
  line: '#E0E0E0',
  rowAlt: '#F7F9FA',
  white: '#FFFFFF',
  accent: '#1565C0',
};

/** Colores del podio por posición (1°, 2°, 3°) */
const PODIUM_COLORS = [COLORS.gold, COLORS.silver, COLORS.bronze];

const PAGE = { width: 595.28, height: 841.89 };  // A4 vertical
const MARGIN = 32;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Fecha larga en español: "12 de septiembre de 2026" */
const longDate = (date) => `${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;

/** Fecha corta dd/mm a partir de "YYYY-MM-DD" (sin que el timezone corra el día) */
const shortDate = (value) => {
  const [y, m, d] = String(value).split('T')[0].split('-');
  return `${d}/${m}`;
};

/** Acorta un texto para que no se desborde de su columna */
const truncate = (text, max) => {
  const value = String(text || '');
  return value.length > max ? `${value.substring(0, max - 1)}…` : value;
};

/** Separador de miles, para que los puntajes grandes se lean de un vistazo */
const formatPoints = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// =============================================
// PIEZAS GRÁFICAS
// =============================================

/**
 * Balón de fútbol vectorial.
 * Círculo blanco con un pentágono central y costuras hacia el borde.
 */
function drawBall(doc, cx, cy, radius) {
  doc.save();
  doc.circle(cx, cy, radius).fillColor(COLORS.white).fill();
  doc.circle(cx, cy, radius).lineWidth(radius * 0.08).strokeColor(COLORS.ink).stroke();

  // Pentágono central
  const inner = radius * 0.42;
  const pentagon = [];
  for (let i = 0; i < 5; i += 1) {
    const angle = (Math.PI / 180) * (-90 + i * 72);
    pentagon.push([cx + inner * Math.cos(angle), cy + inner * Math.sin(angle)]);
  }
  doc.polygon(...pentagon).fillColor(COLORS.ink).fill();

  // Costuras desde cada vértice hacia el borde
  doc.lineWidth(radius * 0.08).strokeColor(COLORS.ink);
  for (const [px, py] of pentagon) {
    const angle = Math.atan2(py - cy, px - cx);
    doc.moveTo(px, py)
      .lineTo(cx + radius * 0.95 * Math.cos(angle), cy + radius * 0.95 * Math.sin(angle))
      .stroke();
  }
  doc.restore();
}

/**
 * Camiseta de fútbol con el dorsal de la posición.
 * Se usa en el podio: el número grande es el puesto (1, 2, 3).
 */
function drawJersey(doc, x, y, width, height, color, number) {
  const sleeve = width * 0.20;
  const shoulder = height * 0.18;
  const bodyX = x + sleeve;
  const bodyW = width - sleeve * 2;

  doc.save();
  // Mangas: caen hacia afuera y abajo desde el hombro
  doc.polygon(
    [bodyX, y],
    [x, y + shoulder * 1.1],
    [x, y + shoulder * 2.4],
    [bodyX, y + shoulder * 1.9],
  ).fillColor(color).fill();
  doc.polygon(
    [bodyX + bodyW, y],
    [x + width, y + shoulder * 1.1],
    [x + width, y + shoulder * 2.4],
    [bodyX + bodyW, y + shoulder * 1.9],
  ).fillColor(color).fill();

  // Cuerpo
  doc.roundedRect(bodyX, y, bodyW, height, 2.5).fillColor(color).fill();

  // Cuello en V
  const neck = width * 0.14;
  doc.polygon(
    [x + width / 2 - neck, y],
    [x + width / 2 + neck, y],
    [x + width / 2, y + height * 0.17],
  ).fillColor(COLORS.white).fill();

  // Dorsal
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(height * 0.44);
  doc.text(String(number), bodyX, y + height * 0.33, { width: bodyW, align: 'center' });
  doc.restore();
}

/** Cabecera tipo cancha: césped con franjas de corte y línea de banda */
function drawFieldHeader(doc, { groupName, churchName, teacher, date }) {
  const height = 96;

  doc.save();
  doc.rect(0, 0, PAGE.width, height).fillColor(COLORS.grass).fill();

  // Franjas de corte del césped
  doc.rect(0, 0, PAGE.width, height).clip();
  const stripe = 34;
  for (let x = 0; x < PAGE.width; x += stripe * 2) {
    doc.rect(x, 0, stripe, height).fillColor(COLORS.grassStripe).fill();
  }
  doc.restore();

  // Línea de banda inferior
  doc.save();
  doc.rect(0, height - 3, PAGE.width, 3).fillColor(COLORS.white).fill();
  doc.restore();

  // Balón
  drawBall(doc, MARGIN + 22, height / 2 - 6, 20);

  // Títulos
  const textX = MARGIN + 56;
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(22);
  doc.text('TABLA DE POSICIONES', textX, 22, { width: CONTENT_WIDTH - 56, characterSpacing: 0.5 });

  doc.font('Helvetica').fontSize(10).fillColor('#C8E6C9');
  doc.text(
    `Club Bíblico · ${groupName}${teacher ? ` · Maestro: ${teacher}` : ''}`,
    textX, 50, { width: CONTENT_WIDTH - 56 },
  );
  doc.fontSize(8.5).fillColor('#A5D6A7');
  doc.text(`${churchName} · ${longDate(date)}`, textX, 64, { width: CONTENT_WIDTH - 56 });

  return height;
}

/** Franja con los datos de la jornada */
function drawStatsBar(doc, y, { players, totalPoints, leader, lastRound }) {
  const height = 34;
  doc.save();
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 6).fillColor('#F1F8E9').fill();

  const cells = [
    { label: 'JUGADORES', value: String(players) },
    { label: 'PUNTOS EN JUEGO', value: formatPoints(totalPoints) },
    { label: 'LÍDER', value: truncate(leader || '—', 18) },
  ];
  if (lastRound && lastRound.date) {
    cells.push({
      label: `ÚLTIMA JORNADA · ${shortDate(lastRound.date)}`,
      value: `+${formatPoints(lastRound.total)}`,
    });
  }
  const cellWidth = CONTENT_WIDTH / cells.length;

  cells.forEach((cell, i) => {
    const x = MARGIN + cellWidth * i;
    if (i > 0) {
      doc.moveTo(x, y + 7).lineTo(x, y + height - 7).lineWidth(0.8).strokeColor('#C5E1A5').stroke();
    }
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(6.5);
    doc.text(cell.label, x, y + 7, { width: cellWidth, align: 'center', characterSpacing: 0.6 });
    doc.fillColor(COLORS.grass).font('Helvetica-Bold').fontSize(12);
    doc.text(cell.value, x, y + 16, { width: cellWidth, align: 'center' });
  });

  doc.restore();
  return height;
}

/**
 * Podio de los tres primeros.
 * Se dibuja en el orden clásico: 2° a la izquierda, 1° al centro, 3° a la derecha.
 */
function drawPodium(doc, y, top3) {
  if (!top3.length) return 0;

  const order = [1, 0, 2];                 // indices: 2, 1, 3
  const heights = [52, 72, 40];            // alto de cada bloque, el del centro mas alto
  const blockW = 128;
  const gap = 14;
  const totalW = blockW * 3 + gap * 2;
  const startX = MARGIN + (CONTENT_WIDTH - totalW) / 2;
  const panelH = 176;
  const baseY = y + panelH - 18;           // linea del piso del podio

  // Panel de cancha detras del podio
  doc.save();
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, panelH, 8).fillColor('#F4F8F2').fill();
  // Circulo central y linea de medio campo, apenas insinuados
  doc.circle(PAGE.width / 2, y + panelH / 2, 52).lineWidth(1).strokeColor('#DDE8D8').stroke();
  doc.moveTo(MARGIN + 10, y + panelH / 2).lineTo(PAGE.width - MARGIN - 10, y + panelH / 2)
    .lineWidth(1).strokeColor('#DDE8D8').stroke();
  doc.restore();

  doc.save();
  doc.fillColor(COLORS.grass).font('Helvetica-Bold').fontSize(10);
  doc.text('EL PODIO DE LA JORNADA', MARGIN, y + 12, {
    width: CONTENT_WIDTH, align: 'center', characterSpacing: 1,
  });
  doc.restore();

  order.forEach((rank, column) => {
    const player = top3[rank];
    if (!player) return;

    const x = startX + column * (blockW + gap);
    const blockH = heights[column];
    const color = PODIUM_COLORS[rank];

    // Camiseta con el dorsal del puesto
    drawJersey(doc, x + blockW / 2 - 21, baseY - blockH - 56, 42, 44, color, rank + 1);

    // Nombre
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9);
    doc.text(truncate(player.full_name, 20), x, baseY - blockH - 8, { width: blockW, align: 'center' });

    // Bloque del podio
    doc.save();
    doc.roundedRect(x, baseY - blockH, blockW, blockH, 4).fillColor(color).fill();
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(19);
    doc.text(formatPoints(player.balance), x, baseY - blockH + blockH / 2 - 14, { width: blockW, align: 'center' });
    doc.font('Helvetica').fontSize(7);
    doc.text('PUNTOS', x, baseY - blockH + blockH / 2 + 7, { width: blockW, align: 'center', characterSpacing: 1 });
    doc.restore();
  });

  // Piso del podio
  doc.save();
  doc.rect(startX - 10, baseY, totalW + 20, 4).fillColor('#CFD8DC').fill();
  doc.restore();

  return panelH;
}

/** Encabezado de las columnas de la tabla */
function drawTableHead(doc, y, cols) {
  const height = 20;
  doc.save();
  doc.rect(MARGIN, y, CONTENT_WIDTH, height).fillColor(COLORS.grass).fill();
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7.5);

  doc.text('#', cols.pos, y + 7, { width: cols.posW, align: 'center', characterSpacing: 0.5 });
  doc.text('JUGADOR', cols.name, y + 7, { width: cols.nameW, characterSpacing: 0.5 });
  doc.text('AVANCE', cols.bar, y + 7, { width: cols.barW, align: 'center', characterSpacing: 0.5 });
  doc.text('JORNADA', cols.round, y + 7, { width: cols.roundW, align: 'right', characterSpacing: 0.5 });
  doc.text('NIVEL', cols.level, y + 7, { width: cols.levelW, align: 'center', characterSpacing: 0.5 });
  doc.text('GANADOS', cols.earned, y + 7, { width: cols.earnedW, align: 'right', characterSpacing: 0.5 });
  doc.text('PUNTOS', cols.points, y + 7, { width: cols.pointsW, align: 'right', characterSpacing: 0.5 });

  doc.restore();
  return height;
}

/** Una fila de la tabla de posiciones */
function drawRow(doc, y, player, position, maxPoints, cols) {
  const height = 22;
  const isPodium = position <= 3;
  const podiumColor = PODIUM_COLORS[position - 1];

  doc.save();

  // Fondo: tenue del color del podio para los tres primeros, alternado para el resto
  if (isPodium) {
    doc.rect(MARGIN, y, CONTENT_WIDTH, height).fillColor(podiumColor).opacity(0.13).fill();
    doc.opacity(1);
  } else if (position % 2 === 0) {
    doc.rect(MARGIN, y, CONTENT_WIDTH, height).fillColor(COLORS.rowAlt).fill();
  }

  // Distintivo de posicion
  if (isPodium) {
    doc.circle(cols.pos + cols.posW / 2, y + height / 2, 8).fillColor(podiumColor).fill();
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(8);
    doc.text(String(position), cols.pos, y + height / 2 - 3.5, { width: cols.posW, align: 'center' });
  } else {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5);
    doc.text(String(position), cols.pos, y + height / 2 - 4, { width: cols.posW, align: 'center' });
  }

  // Nombre
  doc.fillColor(COLORS.ink).font(isPodium ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
  doc.text(truncate(player.full_name, 24), cols.name, y + height / 2 - 4.5, { width: cols.nameW });

  // Barra de avance respecto al lider: de un vistazo se ve quien viene cerca
  const ratio = maxPoints > 0 ? Math.max(0, player.balance) / maxPoints : 0;
  const barY = y + height / 2 - 3.5;
  doc.roundedRect(cols.bar, barY, cols.barW, 7, 3.5).fillColor('#ECEFF1').fill();
  if (ratio > 0) {
    const filled = Math.max(4, cols.barW * ratio);
    doc.roundedRect(cols.bar, barY, filled, 7, 3.5)
      .fillColor(isPodium ? podiumColor : COLORS.grassLight).fill();
  }

  // Puntos de la ultima jornada: lo que sumo en la clase mas reciente
  if (player.last_round > 0) {
    doc.fillColor(COLORS.grassLight).font('Helvetica-Bold').fontSize(8.5);
    doc.text('+' + formatPoints(player.last_round), cols.round, y + height / 2 - 4, { width: cols.roundW, align: 'right' });
  } else {
    doc.fillColor('#BDBDBD').font('Helvetica').fontSize(8.5);
    doc.text('-', cols.round, y + height / 2 - 4, { width: cols.roundW, align: 'right' });
  }

  // Nivel alcanzado
  if (player.level) {
    const chipW = 54;
    const chipX = cols.level + (cols.levelW - chipW) / 2;
    doc.roundedRect(chipX, y + height / 2 - 6.5, chipW, 13, 6.5)
      .fillColor(player.level.color || COLORS.muted).fill();
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(6.5);
    doc.text(truncate(player.level.name, 11), chipX, y + height / 2 - 3, { width: chipW, align: 'center' });
  }

  // Totales
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8);
  doc.text(formatPoints(player.earned), cols.earned, y + height / 2 - 4, { width: cols.earnedW, align: 'right' });

  doc.fillColor(isPodium ? COLORS.grass : COLORS.ink).font('Helvetica-Bold').fontSize(11);
  doc.text(formatPoints(player.balance), cols.points, y + height / 2 - 5.5, { width: cols.pointsW, align: 'right' });

  // Separador
  doc.moveTo(MARGIN, y + height).lineTo(PAGE.width - MARGIN, y + height)
    .lineWidth(0.4).strokeColor(COLORS.line).stroke();

  doc.restore();
  return height;
}

/** Pie de página: leyenda de niveles, firma de entrega y numeración */
function drawFooter(doc, levels, pageNumber) {
  const y = PAGE.height - 64;

  // pdfkit agrega una pagina cuando el texto pasa el margen inferior; al
  // escribir el pie lo anulamos temporalmente para no generar hojas vacias.
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.save();
  doc.moveTo(MARGIN, y).lineTo(PAGE.width - MARGIN, y)
    .lineWidth(0.8).strokeColor(COLORS.line).stroke();

  // Leyenda de niveles
  let chipX = MARGIN;
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(6.5);
  doc.text('NIVELES', chipX, y + 8, { characterSpacing: 0.8 });
  chipX += 38;

  for (const level of levels || []) {
    const label = `${level.name} ${level.min_points}+`;
    const width = doc.font('Helvetica-Bold').fontSize(6.5).widthOfString(label) + 12;
    if (chipX + width > PAGE.width - MARGIN) break;
    doc.roundedRect(chipX, y + 5, width, 12, 6).fillColor(level.color || COLORS.muted).fill();
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(6.5);
    doc.text(label, chipX, y + 8.5, { width, align: 'center' });
    chipX += width + 5;
  }

  // Espacio para firmar la entrega de premios
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5);
  doc.text('Responsable de entrega: ______________________________', MARGIN, y + 28);
  doc.text('Fecha: ____________________', MARGIN + 300, y + 28);

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7);
  doc.text(
    `El nivel se alcanza con el total de puntos ganados y no baja al canjear · Página ${pageNumber}`,
    MARGIN, y + 44, { width: CONTENT_WIDTH, align: 'center' },
  );
  doc.restore();
  doc.page.margins.bottom = savedBottom;
}

// =============================================
// GENERADOR
// =============================================

/**
 * Genera la tabla de posiciones del salón en PDF.
 *
 * @param {Object} params
 * @param {string} params.groupName - Nombre del salón (ej: "Salón A")
 * @param {string} params.churchName - Nombre de la iglesia
 * @param {string} [params.teacher] - Maestro del salón
 * @param {Array} params.levels - Niveles del grupo [{name, min_points, color}]
 * @param {Array} params.students - Participantes ya ordenados por saldo desc
 * @returns {PDFDocument} Documento listo para hacer .pipe(res)
 */
function generateStandingsPdf({ groupName, churchName, teacher, levels, students, lastRound }) {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  const today = new Date();

  // Columnas de la tabla: x de inicio + ancho, sumando el ancho util de la hoja
  const cols = {
    pos: MARGIN, posW: 26,
    name: MARGIN + 30, nameW: 140,
    bar: MARGIN + 176, barW: 100,
    round: MARGIN + 282, roundW: 48,
    level: MARGIN + 336, levelW: 62,
    earned: MARGIN + 404, earnedW: 48,
    points: MARGIN + 458, pointsW: 73,
  };

  const totalPoints = students.reduce((sum, s) => sum + s.balance, 0);
  const maxPoints = students.length ? Math.max(...students.map((s) => s.balance)) : 0;

  // ---- Pagina 1 ----
  let y = drawFieldHeader(doc, { groupName, churchName, teacher, date: today });
  y += 16;

  y += drawStatsBar(doc, y, {
    players: students.length,
    totalPoints,
    leader: students[0] ? students[0].full_name : null,
    lastRound,
  });
  y += 14;

  y += drawPodium(doc, y, students.slice(0, 3));
  y += 14;

  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10);
  doc.text('POSICIONES DEL SALÓN', MARGIN, y, { width: CONTENT_WIDTH, characterSpacing: 1 });
  y += 16;

  y += drawTableHead(doc, y, cols);

  let pageNumber = 1;
  const bottomLimit = PAGE.height - 82;

  students.forEach((player, index) => {
    if (y + 22 > bottomLimit) {
      drawFooter(doc, levels, pageNumber);
      doc.addPage();
      pageNumber += 1;

      // Cabecera compacta en las paginas siguientes
      doc.save();
      doc.rect(0, 0, PAGE.width, 34).fillColor(COLORS.grass).fill();
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(11);
      doc.text(`TABLA DE POSICIONES · ${groupName}`, MARGIN, 11, { width: CONTENT_WIDTH });
      doc.restore();

      y = 50;
      y += drawTableHead(doc, y, cols);
    }
    y += drawRow(doc, y, player, index + 1, maxPoints, cols);
  });

  drawFooter(doc, levels, pageNumber);
  doc.end();

  return doc;
}

module.exports = { generateStandingsPdf };

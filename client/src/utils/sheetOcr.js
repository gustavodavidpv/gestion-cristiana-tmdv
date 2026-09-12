/**
 * sheetOcr.js - Lectura de la hoja de asistencia del Club Bíblico con OCR
 *
 * Todo corre en el navegador con tesseract.js: no se sube ninguna foto a
 * ningún servidor externo.
 *
 * ESTRATEGIA (la letra a mano es el caso difícil del OCR, así que se le
 * facilita el trabajo todo lo posible):
 *
 *  1. Preprocesado: se escala la foto, se pasa a gris, se estira el
 *     contraste y se binariza con Otsu. El lápiz claro sobre papel blanco
 *     mejora muchísimo con esto.
 *  2. Lectura por zonas: la hoja se parte en dos. La franja izquierda
 *     (N° + nombres + apellidos) se lee con alfabeto; la derecha (columnas
 *     de PUNTOS) se lee con una lista blanca de solo dígitos y "+". Separar
 *     las pasadas evita que un "20" se lea como "ZO" y que un nombre se
 *     convierte en números.
 *  3. Armado de filas: las líneas de ambas zonas se cruzan por su posición
 *     vertical, así cada nombre queda con los puntos de su misma fila.
 *  4. Emparejado con la lista real del salón: "David C." → David Castillo,
 *     tolerando abreviaturas, acentos y errores de lectura.
 *
 * Nada de esto se guarda solo: la pantalla de revisión siempre pide
 * confirmación antes de aplicar los puntos.
 */

/** Carga un File/Blob en un elemento <img> ya decodificado */
const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
  img.src = url;
});

/**
 * Umbral de Otsu: encuentra el corte que mejor separa papel de lápiz.
 * @param {number[]} hist - Histograma de 256 niveles de gris
 * @param {number} total - Cantidad de píxeles
 * @returns {number} Nivel de gris usado como umbral
 */
const otsuThreshold = (hist, total) => {
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);

    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
};

/**
 * Prepara la foto para el OCR: escala, gris, contraste y binarización.
 * @param {File|Blob} file - Foto de la hoja
 * @param {Object} options
 * @param {number} options.maxWidth - Ancho máximo de trabajo
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function preprocessSheet(file, { maxWidth = 1800 } = {}) {
  const img = await loadImage(file);

  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const px = imageData.data;
  const total = width * height;

  // --- Gris + histograma ---
  const grey = new Uint8ClampedArray(total);
  const hist = new Array(256).fill(0);
  for (let i = 0, p = 0; i < px.length; i += 4, p += 1) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    grey[p] = g;
    hist[g] += 1;
  }

  // --- Estiramiento de contraste entre los percentiles 2 y 98 ---
  // (ignora los extremos para que una sombra o un brillo no aplasten todo)
  let acc = 0;
  let lo = 0;
  let hi = 255;
  const loTarget = total * 0.02;
  const hiTarget = total * 0.98;
  for (let i = 0; i < 256; i += 1) {
    acc += hist[i];
    if (acc >= loTarget) { lo = i; break; }
  }
  acc = 0;
  for (let i = 0; i < 256; i += 1) {
    acc += hist[i];
    if (acc >= hiTarget) { hi = i; break; }
  }
  const range = Math.max(1, hi - lo);

  const stretched = new Uint8ClampedArray(total);
  const hist2 = new Array(256).fill(0);
  for (let p = 0; p < total; p += 1) {
    const v = Math.max(0, Math.min(255, Math.round(((grey[p] - lo) / range) * 255)));
    stretched[p] = v;
    hist2[v] += 1;
  }

  // --- Binarización ---
  // El umbral se sube un poco para no perder los trazos de lápiz más suaves.
  const threshold = Math.min(250, Math.round(otsuThreshold(hist2, total) * 1.08));
  for (let p = 0, i = 0; p < total; p += 1, i += 4) {
    const v = stretched[p] < threshold ? 0 : 255;
    px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

/** Recorta una franja vertical del canvas (fracciones de 0 a 1) */
const cropVertical = (canvas, from, to) => {
  const x = Math.round(canvas.width * from);
  const w = Math.round(canvas.width * (to - from));
  const out = document.createElement('canvas');
  out.width = w;
  out.height = canvas.height;
  out.getContext('2d').drawImage(canvas, x, 0, w, canvas.height, 0, 0, w, canvas.height);
  return out;
};

/** Aplana el resultado de tesseract a una lista de líneas con su bbox */
const extractLines = (data) => {
  const lines = [];
  for (const block of data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const text = (line.text || '').trim();
        if (text) lines.push({ text, bbox: line.bbox, confidence: line.confidence });
      }
    }
  }
  return lines;
};

/**
 * Suma una expresión escrita a mano tipo "10+10+5+100".
 * No se evalúa como código: solo se extraen los números y se suman.
 * @param {string} text
 * @returns {{ parts: number[], total: number }}
 */
export function sumExpression(text) {
  const parts = (String(text).match(/\d+/g) || [])
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 1000);
  return { parts, total: parts.reduce((a, b) => a + b, 0) };
}

/** Quita acentos, puntos y espacios de más para comparar nombres */
const normalizeName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** Distancia de Levenshtein (para tolerar errores de lectura) */
const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
};

/**
 * Empareja un nombre leído con la lista real del salón.
 * Resuelve abreviaturas ("David C." → David Castillo) y errores de lectura
 * ("Christopher Agüero" → Cristopher Aguero).
 *
 * @param {string} rawName - Texto leído por el OCR
 * @param {Array} students - Participantes del salón ({ id, full_name })
 * @returns {{ student: Object|null, score: number }}
 */
export function matchStudent(rawName, students) {
  const detected = normalizeName(rawName);
  if (!detected || !students.length) return { student: null, score: 0 };

  const detectedTokens = detected.split(' ').filter(Boolean);
  let best = { student: null, score: 0 };

  for (const student of students) {
    const target = normalizeName(student.full_name);
    const targetTokens = target.split(' ').filter(Boolean);
    let score = 0;

    if (detected === target) {
      score = 1;
    } else if (detectedTokens.length && detectedTokens.length <= targetTokens.length) {
      // "david c" contra "david castillo": cada palabra leída debe ser
      // prefijo de la palabra correspondiente del nombre real
      const everyTokenIsPrefix = detectedTokens.every(
        (tk, i) => targetTokens[i] && targetTokens[i].startsWith(tk),
      );
      if (everyTokenIsPrefix) {
        // Más palabras coincidiendo = más confianza
        score = 0.86 + 0.04 * Math.min(detectedTokens.length, 3);
      }
    }

    if (score === 0) {
      // Parecido general, para errores de lectura
      const distance = levenshtein(detected, target);
      const similarity = 1 - distance / Math.max(detected.length, target.length);
      if (similarity > 0.62) score = similarity * 0.85;
    }

    if (score > best.score) best = { student, score };
  }

  return best;
}

/** Clasifica qué tan confiable es una fila leída */
const confidenceLevel = (matchScore, ocrConfidence) => {
  if (matchScore >= 0.86 && ocrConfidence >= 65) return 'alta';
  if (matchScore >= 0.62) return 'media';
  return 'baja';
};

/**
 * Lee una foto de la hoja de asistencia completa.
 *
 * @param {File|Blob} file - Foto tomada con el celular
 * @param {Array} students - Participantes del salón
 * @param {Object} options
 * @param {number} options.splitAt - Fracción del ancho donde empiezan las columnas de puntos
 * @param {Function} options.onProgress - (fase: string, porcentaje: number) => void
 * @returns {Promise<{ rows: Array, preview: string }>}
 */
export async function scanAttendanceSheet(file, students, { splitAt = 0.62, onProgress } = {}) {
  const report = (phase, pct) => { if (onProgress) onProgress(phase, pct); };

  report('Preparando la imagen', 5);
  const canvas = await preprocessSheet(file);

  // tesseract.js se carga solo cuando se usa: no pesa en el arranque de la app
  const { createWorker, PSM } = await import('tesseract.js');

  const nameCanvas = cropVertical(canvas, 0, splitAt);
  const pointsCanvas = cropVertical(canvas, splitAt, 1);

  // ---- Pasada 1: nombres (alfabeto) ----
  report('Leyendo los nombres', 15);
  const nameWorker = await createWorker('spa', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') report('Leyendo los nombres', 15 + m.progress * 35);
    },
  });
  await nameWorker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZabcdefghijklmnñopqrstuvwxyzáéíóúÁÉÍÓÚüÜ. ',
  });
  const nameResult = await nameWorker.recognize(nameCanvas, {}, { blocks: true });
  await nameWorker.terminate();

  // ---- Pasada 2: puntos (solo dígitos y signos) ----
  report('Leyendo los puntos', 55);
  const pointsWorker = await createWorker('spa', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') report('Leyendo los puntos', 55 + m.progress * 40);
    },
  });
  await pointsWorker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    tessedit_char_whitelist: '0123456789+()',
  });
  const pointsResult = await pointsWorker.recognize(pointsCanvas, {}, { blocks: true });
  await pointsWorker.terminate();

  report('Armando las filas', 97);

  const nameLines = extractLines(nameResult.data)
    // Descarta encabezados de la hoja y renglones vacíos
    .filter((l) => {
      const t = normalizeName(l.text);
      return t.length >= 3 && !['n nombres apellidos', 'nombres', 'apellidos', 'lista de asistencia'].includes(t);
    });
  const pointLines = extractLines(pointsResult.data);

  // Cruce por posición vertical: cada nombre con los puntos de su renglón
  const rows = nameLines.map((line, index) => {
    const height = line.bbox.y1 - line.bbox.y0;
    const tolerance = height * 0.55;
    const hit = pointLines.find((p) => {
      const center = (p.bbox.y0 + p.bbox.y1) / 2;
      return center >= line.bbox.y0 - tolerance && center <= line.bbox.y1 + tolerance;
    });

    const rawPoints = hit ? hit.text : '';
    const { parts, total } = sumExpression(rawPoints);
    const { student, score } = matchStudent(line.text, students);

    return {
      id: `row-${index}`,
      rawName: line.text.trim(),
      rawPoints: rawPoints.trim(),
      parts,
      points: total,
      studentId: score >= 0.62 && student ? student.id : '',
      matchScore: score,
      confidence: confidenceLevel(score, Math.min(line.confidence, hit ? hit.confidence : 0)),
    };
  }).filter((row) => row.rawName || row.points > 0);

  report('Listo', 100);

  return { rows, preview: canvas.toDataURL('image/jpeg', 0.7) };
}

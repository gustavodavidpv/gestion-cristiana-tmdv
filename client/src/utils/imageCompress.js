/**
 * imageCompress.js - Reduce una foto en el navegador antes de subirla
 *
 * Las fotos de la tiendita se guardan dentro de la base de datos (el disco
 * del servidor en Render se borra en cada despliegue), así que cada foto
 * debe quedar pequeña: se redimensiona a máx. 900 px por lado y se baja la
 * calidad JPEG hasta que pese menos de ~250 KB. Una foto de celular de 4 MB
 * suele quedar en 60–150 KB y se sigue viendo bien en pantalla.
 */

/** Bytes reales de un data URL base64 */
export const dataUrlBytes = (dataUrl) => {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

/** Carga un File como <img> (el navegador aplica la rotación EXIF del celular) */
const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('No se pudo leer la imagen. Prueba con una foto JPG o PNG.'));
  };
  img.src = url;
});

/**
 * @param {File} file - Foto elegida o tomada con la cámara
 * @param {Object} [opts]
 * @param {number} [opts.maxSide=900] - Lado mayor máximo en píxeles
 * @param {number} [opts.maxBytes=250000] - Peso objetivo
 * @returns {Promise<string>} data URL "data:image/jpeg;base64,..."
 */
export const compressImage = async (file, { maxSide = 900, maxBytes = 250 * 1024 } = {}) => {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('El archivo elegido no es una imagen.');
  }
  const img = await loadImage(file);
  let side = Math.min(maxSide, Math.max(img.naturalWidth, img.naturalHeight));
  let quality = 0.82;
  let dataUrl = '';

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = side / Math.max(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    // JPEG no tiene transparencia: fondo blanco para PNG con huecos
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL('image/jpeg', quality);

    if (dataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
    // Primero se baja la calidad; si no alcanza, se achica la foto
    if (quality > 0.55) quality -= 0.12;
    else side = Math.round(side * 0.8);
  }
  return dataUrl;
};

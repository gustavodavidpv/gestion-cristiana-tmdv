const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const minuteController = require('../controllers/minuteController');
const { authenticate, authorize } = require('../middleware/auth');

// Asegurar que el directorio de uploads exista
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'minutes');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de multer para subir archivos de actas
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Sanitizar nombre: quitar caracteres peligrosos, agregar timestamp
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')  // Sanitizar caracteres especiales
      .replace(/\.{2,}/g, '.');            // Evitar path traversal con ..
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `acta-${uniqueSuffix}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB por archivo
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /pdf|msword|vnd\.openxmlformats|image\/(jpeg|png)/.test(file.mimetype);
    if (extname || mimetype) return cb(null, true);
    cb(new Error('Solo se permiten archivos PDF, DOC, DOCX, JPG o PNG'));
  },
});

router.use(authenticate);

router.get('/', minuteController.getAll);
router.get('/:id', minuteController.getById);

// Crear/editar actas: Administrador, Secretaría
router.post('/', authorize('Administrador', 'Secretaría'), minuteController.create);
router.put('/:id', authorize('Administrador', 'Secretaría'), minuteController.update);
router.delete('/:id', authorize('Administrador'), minuteController.delete);

// Subir archivo(s) de acta — multer .array() para multi-file (máx 5)
router.post('/:id/upload', authorize('Administrador', 'Secretaría'), upload.array('files', 5), minuteController.uploadFiles);

// Eliminar un archivo específico de una acta
router.delete('/:id/files/:fileId', authorize('Administrador', 'Secretaría'), minuteController.deleteFile);

module.exports = router;

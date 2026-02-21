const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const minuteController = require('../controllers/minuteController');
const { authenticate, authorize } = require('../middleware/auth');

// Configuración de multer para subir archivos de actas
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads', 'minutes'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `acta-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
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

// Subir archivo de acta
router.post('/:id/upload', authorize('Administrador', 'Secretaría'), upload.single('file'), minuteController.uploadFile);

module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const brandingController = require('../controllers/brandingController');
const { authenticate, authorize } = require('../middleware/auth');

// Asegurar directorio de logos
const logosDir = path.join(__dirname, '..', 'public', 'uploads', 'logos');
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

// Configuración de multer para logos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo-church-${req.params.churchId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /png|jpg|jpeg|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = /image\/(png|jpeg|gif|webp)/.test(file.mimetype);
    if (ext || mime) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (PNG, JPG, GIF, WEBP)'));
  },
});

// Ruta pública: obtener branding de una iglesia (para Login)
router.get('/:churchId', brandingController.getBranding);

// Rutas protegidas
router.get('/', authenticate, authorize('Administrador'), brandingController.getAllBranding);
router.put('/:churchId', authenticate, authorize('Administrador'), brandingController.updateBranding);
router.post('/:churchId/logo', authenticate, authorize('Administrador'), upload.single('logo'), brandingController.uploadLogo);
router.delete('/:churchId/logo', authenticate, authorize('Administrador'), brandingController.deleteLogo);

module.exports = router;

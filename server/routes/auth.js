const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

// Rutas públicas
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Rutas protegidas
router.get('/me', authenticate, authController.getProfile);

// Permisos del usuario autenticado (para el frontend)
router.get('/my-permissions', authenticate, authController.getMyPermissions);

// Admin: resetear contraseña de cualquier usuario
router.post('/admin-reset-password/:userId', authenticate, authorize('Administrador'), authController.adminResetPassword);

module.exports = router;

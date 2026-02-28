/**
 * routes/notifications.js - Rutas para notificaciones WhatsApp
 * 
 * Endpoints:
 * - GET  /api/notifications/status            → Estado de configuración WhatsApp
 * - GET  /api/notifications/schedule          → Horarios configurados de la iglesia
 * - PUT  /api/notifications/schedule          → Guardar horarios de notificación
 * - GET  /api/notifications/upcoming-cultos   → Cultos próximos con roles asignados
 * - POST /api/notifications/send-reminders    → Envío manual masivo
 * - POST /api/notifications/send/:eventId     → Enviar notificación para un culto específico
 */
const express = require('express');
const router = express.Router();
const { notificationController } = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Estado de configuración WhatsApp
router.get('/status', authorize('Administrador', 'Secretaría'), notificationController.getStatus);

// Horarios de notificación (lectura y escritura)
router.get('/schedule', authorize('Administrador', 'Secretaría'), notificationController.getSchedule);
router.put('/schedule', authorize('Administrador', 'Secretaría'), notificationController.saveSchedule);

// Lista de cultos próximos con roles asignados
router.get('/upcoming-cultos', authorize('Administrador', 'Secretaría'), notificationController.getUpcomingCultos);

// Envío manual de recordatorios
router.post('/send-reminders', authorize('Administrador', 'Secretaría'), notificationController.sendReminders);

// Envío manual para un culto específico (botón "Enviar" por evento)
router.post('/send/:eventId', authorize('Administrador', 'Secretaría'), notificationController.sendForEvent);

module.exports = router;

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
const { authenticate, authorizePermission } = require('../middleware/auth');

router.use(authenticate);

// Estado de configuración WhatsApp — ver notificaciones
router.get('/status', authorizePermission('notifications', 'view'), notificationController.getStatus);

// Horarios de notificación (lectura y escritura)
router.get('/schedule', authorizePermission('notifications', 'view'), notificationController.getSchedule);
router.put('/schedule', authorizePermission('notifications', 'edit'), notificationController.saveSchedule);

// Lista de cultos próximos con roles asignados
router.get('/upcoming-cultos', authorizePermission('notifications', 'view'), notificationController.getUpcomingCultos);

// Envío manual de recordatorios — requiere editar notificaciones
router.post('/send-reminders', authorizePermission('notifications', 'edit'), notificationController.sendReminders);

// Envío manual para un culto específico (botón "Enviar" por evento)
router.post('/send/:eventId', authorizePermission('notifications', 'edit'), notificationController.sendForEvent);

module.exports = router;

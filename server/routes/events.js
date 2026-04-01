const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticate, authorizePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorizePermission('events', 'view'), eventController.getAll);

// Calendario PDF mensual (DEBE ir ANTES de /:id para evitar conflicto de rutas)
router.get('/calendar-pdf', authorizePermission('events', 'view'), eventController.generateCalendar);

// Calendario de Ventas PDF anual (DEBE ir ANTES de /:id)
router.get('/sales-calendar-pdf', authorizePermission('events', 'view'), eventController.generateSalesCalendar);

router.get('/:id', authorizePermission('events', 'view'), eventController.getById);

// Crear eventos: controlado por permisos dinámicos
router.post('/', authorizePermission('events', 'create'), eventController.create);
router.put('/:id', authorizePermission('events', 'edit'), eventController.update);
router.delete('/:id', authorizePermission('events', 'delete'), eventController.delete);

// Asistentes: permiso especial 'attendance'
router.post('/:id/attendees', authorizePermission('events', 'attendance'), eventController.addAttendees);

module.exports = router;

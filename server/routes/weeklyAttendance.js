const express = require('express');
const router = express.Router();
const weeklyAttendanceController = require('../controllers/weeklyAttendanceController');
const { authenticate, authorizePermission } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Listar registros de asistencia semanal
router.get('/', authorizePermission('weekly_attendance', 'view'), weeklyAttendanceController.getAll);

// Crear/editar/eliminar: controlado por permisos dinámicos
router.post('/', authorizePermission('weekly_attendance', 'create'), weeklyAttendanceController.create);
router.put('/:id', authorizePermission('weekly_attendance', 'edit'), weeklyAttendanceController.update);
router.delete('/:id', authorizePermission('weekly_attendance', 'delete'), weeklyAttendanceController.delete);

module.exports = router;

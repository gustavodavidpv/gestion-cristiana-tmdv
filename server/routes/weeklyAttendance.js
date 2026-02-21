const express = require('express');
const router = express.Router();
const weeklyAttendanceController = require('../controllers/weeklyAttendanceController');
const { authenticate, authorize } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Listar registros de asistencia semanal
router.get('/', weeklyAttendanceController.getAll);

// Crear: Administrador, Secretaría, Líder
router.post('/', authorize('Administrador', 'Secretaría', 'Líder'), weeklyAttendanceController.create);

// Editar: Administrador, Secretaría
router.put('/:id', authorize('Administrador', 'Secretaría'), weeklyAttendanceController.update);

// Eliminar: Solo Administrador
router.delete('/:id', authorize('Administrador'), weeklyAttendanceController.delete);

module.exports = router;

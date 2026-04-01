/**
 * permissions.js - Rutas de gestión de permisos por rol
 *
 * Solo accesible por SuperAdmin.
 * GET  /api/permissions — Obtener matriz completa de permisos
 * PUT  /api/permissions — Actualizar permisos en bloque
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const permissionController = require('../controllers/permissionController');

// Todas las rutas requieren autenticación + rol SuperAdmin
router.use(authenticate);
router.use(authorize('SuperAdmin'));

router.get('/', permissionController.getAll);
router.put('/', permissionController.updateAll);

module.exports = router;

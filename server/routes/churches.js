const express = require('express');
const router = express.Router();
const churchController = require('../controllers/churchController');
const { authenticate, authorize, authorizePermission } = require('../middleware/auth');

router.use(authenticate);

// Iglesias — view controlado por permisos dinámicos
router.get('/', authorizePermission('churches', 'view'), churchController.getAll);
// Estadísticas del dashboard para SuperAdmin (DEBE ir ANTES de /:id)
router.get('/stats/dashboard', authorize('SuperAdmin'), churchController.getDashboardStats);
// Resumen ligero del dashboard para roles con permiso `dashboard.view`
// Ej: un rol con solo "ver dashboard" puede consultar decisiones de fe del año
// sin necesidad de tener `churches.view` sobre el recurso completo.
// IMPORTANTE: debe ir ANTES de /:id para no colisionar con esa ruta dinámica.
router.get('/my/summary', authorizePermission('dashboard', 'view'), churchController.getMySummary);
router.get('/:id', authorizePermission('churches', 'view'), churchController.getById);
// Solo SuperAdmin puede CREAR y ELIMINAR iglesias (no delegable)
router.post('/', authorize('SuperAdmin'), churchController.create);
router.put('/:id', authorizePermission('churches', 'edit'), churchController.update);
router.delete('/:id', authorize('SuperAdmin'), churchController.delete);

// Misiones — edit de iglesias permite gestionar misiones
router.post('/:id/missions', authorizePermission('churches', 'edit'), churchController.createMission);
router.put('/:id/missions/:missionId', authorizePermission('churches', 'edit'), churchController.updateMission);
router.delete('/:id/missions/:missionId', authorizePermission('churches', 'delete'), churchController.deleteMission);

// Campos Blancos — edit de iglesias permite gestionar campos blancos
router.post('/:id/white-fields', authorizePermission('churches', 'edit'), churchController.createWhiteField);
router.put('/:id/white-fields/:fieldId', authorizePermission('churches', 'edit'), churchController.updateWhiteField);
router.delete('/:id/white-fields/:fieldId', authorizePermission('churches', 'delete'), churchController.deleteWhiteField);

module.exports = router;

const express = require('express');
const router = express.Router();
const churchController = require('../controllers/churchController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Iglesias
router.get('/', churchController.getAll);
router.get('/:id', churchController.getById);
// Solo SuperAdmin puede CREAR y ELIMINAR iglesias (authorize bypasses SuperAdmin)
router.post('/', authorize('SuperAdmin'), churchController.create);
router.put('/:id', authorize('Administrador'), churchController.update);
router.delete('/:id', authorize('SuperAdmin'), churchController.delete);

// Misiones
router.post('/:id/missions', authorize('Administrador', 'Secretaría'), churchController.createMission);
router.put('/:id/missions/:missionId', authorize('Administrador', 'Secretaría'), churchController.updateMission);
router.delete('/:id/missions/:missionId', authorize('Administrador'), churchController.deleteMission);

// Campos Blancos
router.post('/:id/white-fields', authorize('Administrador', 'Secretaría'), churchController.createWhiteField);
router.put('/:id/white-fields/:fieldId', authorize('Administrador', 'Secretaría'), churchController.updateWhiteField);
router.delete('/:id/white-fields/:fieldId', authorize('Administrador'), churchController.deleteWhiteField);

module.exports = router;

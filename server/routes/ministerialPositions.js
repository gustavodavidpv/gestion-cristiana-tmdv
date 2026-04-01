const express = require('express');
const router = express.Router();
const ministerialPositionController = require('../controllers/ministerialPositionController');
const { authenticate, authorizePermission } = require('../middleware/auth');

router.use(authenticate);

// Listar cargos ministeriales — controlado por permisos dinámicos
router.get('/', authorizePermission('positions', 'view'), ministerialPositionController.getAll);
router.get('/:id', authorizePermission('positions', 'view'), ministerialPositionController.getById);

// CRUD: controlado por permisos dinámicos (SuperAdmin bypass automático)
router.post('/', authorizePermission('positions', 'create'), ministerialPositionController.create);
router.put('/:id', authorizePermission('positions', 'edit'), ministerialPositionController.update);
router.delete('/:id', authorizePermission('positions', 'delete'), ministerialPositionController.delete);

module.exports = router;

const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { authenticate, authorizePermission } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticate);

router.get('/', authorizePermission('members', 'view'), memberController.getAll);
router.get('/:id', authorizePermission('members', 'view'), memberController.getById);

// Crear/editar/eliminar: controlado por permisos dinámicos
router.post('/', authorizePermission('members', 'create'), memberController.create);
router.put('/:id', authorizePermission('members', 'edit'), memberController.update);
router.delete('/:id', authorizePermission('members', 'delete'), memberController.delete);

module.exports = router;

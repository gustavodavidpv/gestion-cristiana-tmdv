const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorizePermission } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Roles (va primero para evitar conflicto con :id) — view de usuarios permite ver roles
router.get('/roles', authorizePermission('users', 'view'), userController.getRoles);

// CRUD controlado por permisos dinámicos
router.get('/', authorizePermission('users', 'view'), userController.getAll);
router.get('/:id', authorizePermission('users', 'view'), userController.getById);
router.post('/', authorizePermission('users', 'create'), userController.create);
router.put('/:id', authorizePermission('users', 'edit'), userController.update);
router.delete('/:id', authorizePermission('users', 'delete'), userController.delete);

module.exports = router;

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// Todas las rutas requieren autenticación y rol Administrador
router.use(authenticate);
router.use(authorize('Administrador'));

// Roles (va primero para evitar conflicto con :id)
router.get('/roles', userController.getRoles);

router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.delete('/:id', userController.delete);

module.exports = router;

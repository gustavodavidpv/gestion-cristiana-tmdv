const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { authenticate, authorize } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticate);

router.get('/', memberController.getAll);
router.get('/:id', memberController.getById);

// Crear/editar/eliminar: Administrador, Secretaría, Líder
router.post('/', authorize('Administrador', 'Secretaría', 'Líder'), memberController.create);
router.put('/:id', authorize('Administrador', 'Secretaría', 'Líder'), memberController.update);
router.delete('/:id', authorize('Administrador'), memberController.delete);

module.exports = router;

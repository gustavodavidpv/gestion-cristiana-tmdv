const express = require('express');
const router = express.Router();
const ministerialPositionController = require('../controllers/ministerialPositionController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ministerialPositionController.getAll);
router.get('/:id', ministerialPositionController.getById);

// CRUD: Administrador y SuperAdmin (SuperAdmin bypass automático en authorize)
router.post('/', authorize('Administrador'), ministerialPositionController.create);
router.put('/:id', authorize('Administrador'), ministerialPositionController.update);
router.delete('/:id', authorize('Administrador'), ministerialPositionController.delete);

module.exports = router;

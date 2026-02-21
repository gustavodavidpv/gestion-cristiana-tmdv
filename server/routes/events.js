const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', eventController.getAll);
router.get('/:id', eventController.getById);

// Crear eventos: Administrador, Secretaría, Líder
router.post('/', authorize('Administrador', 'Secretaría', 'Líder'), eventController.create);
router.put('/:id', authorize('Administrador', 'Secretaría', 'Líder'), eventController.update);
router.delete('/:id', authorize('Administrador'), eventController.delete);

// Asistentes
router.post('/:id/attendees', authorize('Administrador', 'Secretaría', 'Líder'), eventController.addAttendees);

module.exports = router;

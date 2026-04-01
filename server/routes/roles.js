const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const roleController = require('../controllers/roleController');

router.use(authenticate);
router.use(authorize('SuperAdmin'));

router.get('/', roleController.getAll);
router.post('/', roleController.create);
router.put('/:id', roleController.update);
router.delete('/:id', roleController.delete);

module.exports = router;

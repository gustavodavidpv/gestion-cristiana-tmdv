const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/members', require('./members'));
router.use('/churches', require('./churches'));
router.use('/events', require('./events'));
router.use('/minutes', require('./minutes'));
router.use('/weekly-attendance', require('./weeklyAttendance'));
router.use('/ministerial-positions', require('./ministerialPositions'));
router.use('/branding', require('./branding'));
router.use('/notifications', require('./notifications'));

module.exports = router;

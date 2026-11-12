const express = require('express');
const router = express.Router();
const bibleClubController = require('../controllers/bibleClubController');
const storeController = require('../controllers/bibleClubStoreController');
const { authenticate, authorizePermission } = require('../middleware/auth');

router.use(authenticate);

// ===== Grupos / salones =====
router.get('/groups', authorizePermission('bible_club', 'view'), bibleClubController.getGroups);
router.post('/groups', authorizePermission('bible_club', 'create'), bibleClubController.createGroup);
router.put('/groups/:id', authorizePermission('bible_club', 'edit'), bibleClubController.updateGroup);
router.delete('/groups/:id', authorizePermission('bible_club', 'delete'), bibleClubController.deleteGroup);

// ===== Tabla de posiciones en PDF =====
router.get('/groups/:id/standings.pdf', authorizePermission('bible_club', 'view'), bibleClubController.generateStandings);

// ===== Participantes =====
router.get('/students', authorizePermission('bible_club', 'view'), bibleClubController.getStudents);
router.get('/students/:id/transactions', authorizePermission('bible_club', 'view'), bibleClubController.getTransactions);
router.post('/students', authorizePermission('bible_club', 'create'), bibleClubController.createStudent);
router.put('/students/:id', authorizePermission('bible_club', 'edit'), bibleClubController.updateStudent);
router.delete('/students/:id', authorizePermission('bible_club', 'delete'), bibleClubController.deleteStudent);

// ===== Movimientos de puntos y canjes =====
router.get('/transactions', authorizePermission('bible_club', 'view'), bibleClubController.getGroupTransactions);
router.post('/transactions', authorizePermission('bible_club', 'create'), bibleClubController.createTransactions);
router.put('/transactions/:id', authorizePermission('bible_club', 'edit'), bibleClubController.updateTransaction);
router.delete('/transactions/:id', authorizePermission('bible_club', 'delete'), bibleClubController.deleteTransaction);

// ===== Tiendita (catálogo de artículos canjeables) =====
router.get('/store', authorizePermission('bible_club', 'view'), storeController.getStore);
router.put('/store', authorizePermission('bible_club', 'edit'), storeController.updateStore);
router.post('/store/items', authorizePermission('bible_club', 'create'), storeController.createItem);
router.put('/store/items/:id', authorizePermission('bible_club', 'edit'), storeController.updateItem);
router.delete('/store/items/:id', authorizePermission('bible_club', 'delete'), storeController.deleteItem);

module.exports = router;

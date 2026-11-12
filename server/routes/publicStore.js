/**
 * publicStore.js - Tiendita del Club Bíblico, SIN sesión
 *
 * Es el enlace que se comparte con los muchachos (/tienda/<código>).
 * Solo lectura: catálogo con fotos y tabla de posiciones abreviada.
 */
const express = require('express');
const router = express.Router();
const storeController = require('../controllers/bibleClubStoreController');

// Antes que '/:code' para que "items" no se tome como código
router.get('/items/:id/image', storeController.getItemImage);
router.get('/:code', storeController.getPublicStore);

module.exports = router;

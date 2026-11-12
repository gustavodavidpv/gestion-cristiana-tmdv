/**
 * BibleClubItem.js - Artículo de la tiendita del Club Bíblico
 *
 * Los muchachos canjean sus puntos por estos artículos. La foto se guarda
 * dentro de la base de datos (ya comprimida por el navegador, ~100 KB) porque
 * el disco del servidor en Render se borra en cada despliegue.
 *
 * - stock = null  → sin control de inventario (siempre disponible)
 * - stock = 0     → "Agotado" en la página pública
 * - image_version → sube con cada foto nueva; va en la URL para que el
 *                   navegador no muestre una foto vieja guardada en caché
 *
 * La columna `image` NO se trae por defecto (defaultScope) para que los
 * listados no carguen los bytes de todas las fotos; se pide con
 * BibleClubItem.scope('withImage').
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BibleClubItem = sequelize.define('BibleClubItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // Iglesia dueña de la tiendita
  church_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // Nombre del artículo (ej: Audífonos)
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Puntos que cuesta canjearlo
  points_cost: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  // Unidades disponibles; null = sin control de inventario
  stock: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // Foto comprimida (bytes)
  image: {
    type: DataTypes.BLOB,
    allowNull: true,
  },
  // Tipo MIME de la foto (image/jpeg, image/webp, image/png)
  image_type: {
    type: DataTypes.STRING(40),
    allowNull: true,
  },
  image_version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  // Inactivo = oculto en la página pública
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'bible_club_items',
  indexes: [{ fields: ['church_id'] }],
  defaultScope: { attributes: { exclude: ['image'] } },
  scopes: { withImage: { attributes: { include: ['image'] } } },
});

module.exports = BibleClubItem;

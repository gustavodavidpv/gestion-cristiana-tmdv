/**
 * BibleClubStore.js - Configuración de la página pública de la tiendita
 *
 * Una fila por iglesia. El enlace público usa `public_code` (aleatorio) en
 * lugar del id de la iglesia para que nadie pueda ver las tiendas de otras
 * iglesias probando números. Si el enlace se comparte donde no debía, el
 * administrador genera un código nuevo y el anterior deja de funcionar.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BibleClubStore = sequelize.define('BibleClubStore', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  church_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  // Código del enlace público: /tienda/<public_code>
  public_code: {
    type: DataTypes.STRING(24),
    allowNull: false,
    unique: true,
  },
  // Título de la página (por defecto "Tiendita del Club Bíblico")
  title: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  // Aviso para los muchachos (ej: "Los canjes son el último sábado del mes")
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // false = el enlace público muestra "Tienda cerrada"
  is_public: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  // Mostrar la tabla de posiciones de cada salón en la página pública
  show_standings: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'bible_club_stores',
});

module.exports = BibleClubStore;

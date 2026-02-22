/**
 * MinisterialPosition.js - Cargos ministeriales escalables
 * 
 * Tabla: ministerial_positions
 * Permite a cada iglesia definir sus propios cargos ministeriales.
 * El Admin puede CRUD los cargos de su iglesia; SuperAdmin de todas.
 * 
 * Se vincula a members.position_id (FK) para asignar un cargo a un miembro.
 * Se mantiene compatibilidad con church_role (texto) para backfill.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MinisterialPosition = sequelize.define('MinisterialPosition', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  church_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'churches', key: 'id' },
    comment: 'Iglesia a la que pertenece este cargo (multi-tenant)',
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Nombre del cargo (ej: Pastor, Diácono Ordenado, Líder de Alabanza)',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descripción o responsabilidades del cargo',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Si false, el cargo no aparece para asignar pero no se borra',
  },
}, {
  tableName: 'ministerial_positions',
});

module.exports = MinisterialPosition;

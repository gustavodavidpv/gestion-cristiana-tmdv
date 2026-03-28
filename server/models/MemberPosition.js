/**
 * MemberPosition.js - Tabla junction para relación M:N entre Members y MinisterialPositions.
 *
 * Permite que un miembro tenga múltiples cargos ministeriales simultáneamente.
 * Restricción UNIQUE en (member_id, position_id) para evitar duplicados.
 *
 * Creada como parte de la migración de position_id (1:N) a member_positions (M:N).
 * La columna members.position_id se mantiene para backward compatibility con church_role sync.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MemberPosition = sequelize.define('MemberPosition', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'FK a members.id',
  },
  position_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'FK a ministerial_positions.id',
  },
}, {
  tableName: 'member_positions',
  indexes: [
    // Evitar que un miembro tenga el mismo cargo duplicado
    { unique: true, fields: ['member_id', 'position_id'] },
  ],
});

module.exports = MemberPosition;

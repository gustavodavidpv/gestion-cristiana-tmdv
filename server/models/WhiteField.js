const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WhiteField = sequelize.define('WhiteField', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  church_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'churches', key: 'id' },
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  responsible_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'members', key: 'id' },
  },
  /**
   * Campos de responsable manual (texto libre).
   * Permiten registrar un responsable sin necesidad de que sea miembro.
   */
  responsible_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Nombre y apellido del responsable (texto libre)',
  },
  responsible_phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'Celular/contacto del responsable',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'white_fields',
});

module.exports = WhiteField;

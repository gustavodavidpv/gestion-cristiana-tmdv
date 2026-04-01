const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: {
        msg: 'El nombre del rol es requerido.',
      },
      len: {
        args: [2, 50],
        msg: 'El nombre del rol debe tener entre 2 y 50 caracteres.',
      },
    },
    set(value) {
      this.setDataValue('name', typeof value === 'string' ? value.trim() : value);
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    set(value) {
      const normalized = typeof value === 'string' ? value.trim() : value;
      this.setDataValue('description', normalized || null);
    },
  },
}, {
  tableName: 'roles',
});

module.exports = Role;

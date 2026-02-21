const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Motion = sequelize.define('Motion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  minute_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'minutes', key: 'id' },
  },
  title: {
    type: DataTypes.STRING(300),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  result: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'Pendiente',
    validate: {
      isIn: [['Aprobado', 'Rechazado', 'Pendiente']],
    },
  },
  order_num: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'motions',
});

module.exports = Motion;

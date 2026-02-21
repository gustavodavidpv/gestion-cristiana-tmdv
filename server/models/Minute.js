const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Minute = sequelize.define('Minute', {
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
  title: {
    type: DataTypes.STRING(300),
    allowNull: false,
  },
  objective: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Objetivo de la reunión',
  },
  meeting_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  file_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Archivo adjunto del acta',
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
}, {
  tableName: 'minutes',
});

module.exports = Minute;

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Church = sequelize.define('Church', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  logo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  responsible: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Responsable de la Obra',
  },
  membership_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Membresía total',
  },
  avg_weekly_attendance: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Asistencia promedio semanal',
  },
  faith_decisions_year: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Personas que han tomado decisión de fe en el año',
  },
  faith_decisions_ref_year: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Año de referencia para decisiones de fe',
  },
  ordained_preachers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Predicadores ordenados',
  },
  unordained_preachers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Predicadores no ordenados',
  },
  ordained_deacons: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Diáconos ordenados',
  },
  unordained_deacons: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Diáconos no ordenados',
  },
}, {
  tableName: 'churches',
});

module.exports = Church;

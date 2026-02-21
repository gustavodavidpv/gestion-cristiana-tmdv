/**
 * WeeklyAttendance.js - Modelo de asistencia semanal
 * 
 * Registra la asistencia de cada semana para una iglesia.
 * El promedio de todos los registros se calcula automáticamente
 * y se almacena en churches.avg_weekly_attendance.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WeeklyAttendance = sequelize.define('WeeklyAttendance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  church_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'churches', key: 'id' },
    comment: 'Iglesia a la que pertenece este registro',
  },
  week_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Fecha del domingo o día principal de la semana',
  },
  attendance_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0 },
    comment: 'Número de personas que asistieron esta semana',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas opcionales (ej: evento especial, baja asistencia por lluvia)',
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    comment: 'Usuario que registró la asistencia',
  },
}, {
  tableName: 'weekly_attendances',
  // Índice único: solo un registro por iglesia por semana
  indexes: [
    {
      unique: true,
      fields: ['church_id', 'week_date'],
      name: 'unique_church_week',
    },
  ],
});

module.exports = WeeklyAttendance;

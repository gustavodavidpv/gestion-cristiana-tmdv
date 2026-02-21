const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * EventAttendee: Tabla intermedia entre Event y Member (relación N:M)
 * 
 * FIX CRÍTICO: Se agrega índice UNIQUE en (event_id, member_id) para evitar
 * que un mismo miembro se registre múltiples veces en el mismo evento.
 * Este era el bug que causaba duplicados en la interfaz.
 */
const EventAttendee = sequelize.define('EventAttendee', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'events', key: 'id' },
  },
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'members', key: 'id' },
  },
  attended: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  made_faith_decision: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'event_attendees',
  // ÍNDICE ÚNICO: un miembro solo puede estar UNA vez por evento
  indexes: [
    {
      unique: true,
      fields: ['event_id', 'member_id'],
      name: 'unique_event_member', // Nombre explícito del índice
    },
  ],
});

module.exports = EventAttendee;

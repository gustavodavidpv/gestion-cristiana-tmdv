const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Event = sequelize.define('Event', {
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
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  event_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Tipo: Evangelismo, Culto, Reunión, etc.',
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING(300),
    allowNull: true,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  faith_decisions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Decisiones de fe registradas en este evento',
  },
  attendees_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  // =============================================
  // ROLES DE CULTO (solo aplican si event_type === 'Culto')
  // =============================================

  /**
   * preacher_id - Miembro que PREDICA en este culto.
   * FK a members.id. Null si no es un culto o no se asignó.
   */
  preacher_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    comment: 'FK al miembro que predica en este culto',
  },
  /**
   * worship_leader_id - Miembro que DIRIGE la adoración en este culto.
   * FK a members.id. Null si no es un culto o no se asignó.
   */
  worship_leader_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    comment: 'FK al miembro que dirige la adoración en este culto',
  },
  /**
   * singer_id - Miembro que CANTA (líder de cánticos) en este culto.
   * FK a members.id. Null si no es un culto o no se asignó.
   */
  singer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    comment: 'FK al miembro que canta en este culto',
  },
}, {
  tableName: 'events',
});

module.exports = Event;

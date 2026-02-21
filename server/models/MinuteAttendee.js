const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MinuteAttendee = sequelize.define('MinuteAttendee', {
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
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'members', key: 'id' },
  },
}, {
  tableName: 'minute_attendees',
});

module.exports = MinuteAttendee;

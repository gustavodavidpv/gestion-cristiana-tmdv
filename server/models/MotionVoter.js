const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MotionVoter = sequelize.define('MotionVoter', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  motion_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'motions', key: 'id' },
  },
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'members', key: 'id' },
  },
  vote_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['Votante', 'Secundador']],
    },
  },
}, {
  tableName: 'motion_voters',
});

module.exports = MotionVoter;

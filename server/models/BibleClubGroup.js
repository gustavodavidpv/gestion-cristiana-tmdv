/**
 * BibleClubGroup.js - Grupo/salón del Club Bíblico (adolescentes)
 *
 * Cada iglesia puede tener varios grupos (ej: "Salón A", "Salón B").
 * Los niveles de premiación son configurables por grupo; si quedan en null
 * se usan los DEFAULT_LEVELS de config/bibleClub.js.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BibleClubGroup = sequelize.define('BibleClubGroup', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  church_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'churches', key: 'id' },
    comment: 'Iglesia a la que pertenece el grupo',
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Nombre del grupo o salón (ej: Salón A)',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  teacher: {
    type: DataTypes.STRING(150),
    allowNull: true,
    comment: 'Maestro o responsable del grupo',
  },
  levels: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Niveles personalizados [{name, min_points, color}]; null = niveles por defecto',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'bible_club_groups',
});

module.exports = BibleClubGroup;

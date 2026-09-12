/**
 * BibleClubStudent.js - Estudiante (adolescente) del Club Bíblico
 *
 * Pertenece a un grupo. El saldo de puntos NO se guarda aquí: se calcula
 * sumando bible_club_transactions, de modo que el historial siempre cuadra
 * con el saldo mostrado.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BibleClubStudent = sequelize.define('BibleClubStudent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  church_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'churches', key: 'id' },
    comment: 'Iglesia (denormalizado desde el grupo para filtrar por tenant)',
  },
  group_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'bible_club_groups', key: 'id' },
    comment: 'Grupo/salón al que pertenece',
  },
  full_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    comment: 'Nombre completo del participante',
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'Teléfono de contacto (del participante o acudiente)',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'bible_club_students',
  indexes: [{ fields: ['group_id'] }],
});

module.exports = BibleClubStudent;

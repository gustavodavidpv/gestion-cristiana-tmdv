/**
 * BibleClubTransaction.js - Movimiento de puntos de un estudiante
 *
 * Un solo registro cubre tanto los puntos ganados como los canjes:
 *  - type 'earn':   points > 0  (asistencia, Biblia, invitados, bonos...)
 *  - type 'redeem': points < 0  (canje de artículo; guarda 'item')
 *  - type 'adjust': corrección manual (puede ser + o -)
 *
 * El saldo del estudiante es SUM(points) y el nivel máximo se calcula con
 * la suma de los movimientos positivos (nunca baja al canjear).
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BibleClubTransaction = sequelize.define('BibleClubTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'bible_club_students', key: 'id' },
  },
  church_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'churches', key: 'id' },
    comment: 'Iglesia (denormalizado para filtrar por tenant)',
  },
  type: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'earn',
    comment: "earn | redeem | adjust",
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Positivo suma al saldo, negativo lo descuenta',
  },
  activity_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Fecha de la clase/entrega (normalmente el sábado)',
  },
  reason: {
    type: DataTypes.STRING(120),
    allowNull: true,
    comment: 'Motivo: Por llevar Biblia, Por llegar temprano, Por traer invitados...',
  },
  item: {
    type: DataTypes.STRING(150),
    allowNull: true,
    comment: 'Artículo canjeado (solo en type = redeem)',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Detalle libre, ej: desglose "10+10+5+100"',
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
}, {
  tableName: 'bible_club_transactions',
  indexes: [{ fields: ['student_id'] }, { fields: ['activity_date'] }],
});

module.exports = BibleClubTransaction;

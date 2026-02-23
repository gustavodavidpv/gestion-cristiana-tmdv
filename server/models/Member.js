const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Member.js - Modelo de miembros de la iglesia
 * 
 * Incluye campo opcional 'church_role' para definir si el miembro tiene
 * un cargo especial (Predicador/Diácono, Ordenado/No Ordenado).
 * Los contadores de cada tipo se calculan automáticamente en la tabla churches.
 */
const Member = sequelize.define('Member', {
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
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 0, max: 150 },
  },
  sex: {
    type: DataTypes.CHAR(1),
    allowNull: true,
    validate: { isIn: [['M', 'F']] },
  },
  baptized: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  /**
   * birth_date - Fecha de nacimiento del miembro (OPCIONAL)
   * Se usa para calcular la edad automáticamente si no se indica 'age'.
   */
  birth_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Fecha de nacimiento del miembro',
  },
  member_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'Miembro',
    validate: {
      isIn: [['Miembro', 'Visitante', 'Familiar', 'Infante', 'Otro']],
    },
  },
  /**
   * church_role - Cargo ministerial del miembro (texto, auto-sincronizado)
   * 
   * ANTES era un campo con valores fijos (Predicador Ordenado, etc.).
   * AHORA se auto-sincroniza desde position_id: cuando se asigna un cargo
   * via el select dinámico (position_id → ministerial_positions.name),
   * el controller copia el nombre del cargo aquí automáticamente.
   * 
   * Esto permite que las estadísticas (ordained_preachers, etc.) sigan
   * funcionando sin cambios, ya que leen desde esta columna.
   * 
   * Se removió la validación isIn rígida porque ahora los cargos son
   * dinámicos (el admin puede crear cualquier cargo en "Cargos Ministeriales").
   * 
   * Al crear/editar/eliminar un miembro, se recalculan automáticamente
   * los contadores en la tabla churches:
   *   ordained_preachers, unordained_preachers,
   *   ordained_deacons, unordained_deacons
   */
  church_role: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
    comment: 'Nombre del cargo ministerial. Auto-sincronizado desde position_id.',
  },
  /**
   * position_id - FK a ministerial_positions (NUEVO, escalable)
   * 
   * Referencia al cargo ministerial definido por la iglesia.
   * Coexiste con church_role para backfill.
   */
  position_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    // NO poner references aquí — Sequelize genera SQL inválido en ALTER.
    // La FK se crea manualmente en migrations/run.js y la asociación
    // se define en models/index.js (Member.belongsTo MinisterialPosition).
    comment: 'FK al cargo ministerial de la iglesia (nuevo sistema escalable)',
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  photo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'members',
});

module.exports = Member;

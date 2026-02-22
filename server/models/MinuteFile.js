/**
 * MinuteFile.js - Archivos adjuntos de actas
 * 
 * Tabla: minute_files
 * Permite subir 1 o varios archivos por acta.
 * Los archivos se guardan en public/uploads/minutes/
 * y la metadata se almacena aquí.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MinuteFile = sequelize.define('MinuteFile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  minute_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'minutes', key: 'id' },
    comment: 'Acta a la que pertenece este archivo',
  },
  file_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Ruta relativa del archivo (ej: /uploads/minutes/acta-123456.pdf)',
  },
  original_name: {
    type: DataTypes.STRING(300),
    allowNull: false,
    comment: 'Nombre original del archivo subido',
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Tamaño en bytes',
  },
  file_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'MIME type del archivo',
  },
}, {
  tableName: 'minute_files',
});

module.exports = MinuteFile;

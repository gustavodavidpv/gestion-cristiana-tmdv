/**
 * weeklyAttendanceController.js
 * 
 * CRUD de registros de asistencia semanal.
 * Cada vez que se crea, edita o elimina un registro,
 * se recalcula automáticamente el promedio de asistencia
 * semanal de la iglesia (avg_weekly_attendance).
 */
const { WeeklyAttendance, Church, User } = require('../models');
const { Op } = require('sequelize');
const { recalculateAvgWeeklyAttendance } = require('../utils/churchStats');

const weeklyAttendanceController = {
  /**
   * GET /api/weekly-attendance
   * Lista los registros de asistencia semanal con paginación.
   * Filtrable por año. Incluye el promedio actual.
   */
  async getAll(req, res) {
    try {
      const { year, page = 1, limit = 52 } = req.query;
      const churchId = req.user.church_id;

      if (!churchId) {
        return res.status(400).json({ message: 'No tiene iglesia asignada.' });
      }

      const where = { church_id: churchId };

      // Filtrar por año si se especifica
      if (year) {
        where.week_date = {
          [Op.between]: [`${year}-01-01`, `${year}-12-31`],
        };
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows: records, count: total } = await WeeklyAttendance.findAndCountAll({
        where,
        include: [
          { model: User, as: 'creator', attributes: ['id', 'full_name'] },
        ],
        order: [['week_date', 'DESC']],
        limit: parseInt(limit),
        offset,
      });

      // Obtener el promedio actual de la iglesia
      const church = await Church.findByPk(churchId, {
        attributes: ['avg_weekly_attendance'],
      });

      res.json({
        records,
        avg_weekly_attendance: church?.avg_weekly_attendance || 0,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener registros de asistencia.', error: error.message });
    }
  },

  /**
   * POST /api/weekly-attendance
   * Crear un nuevo registro de asistencia semanal.
   * Si ya existe un registro para esa semana, devuelve error.
   * Recalcula el promedio automáticamente.
   */
  async create(req, res) {
    try {
      const { week_date, attendance_count, notes } = req.body;
      const churchId = req.user.church_id;

      if (!churchId) {
        return res.status(400).json({ message: 'No tiene iglesia asignada.' });
      }

      // Validar datos
      if (!week_date) {
        return res.status(400).json({ message: 'La fecha de la semana es requerida.' });
      }
      if (attendance_count === undefined || attendance_count < 0) {
        return res.status(400).json({ message: 'La asistencia debe ser un número positivo.' });
      }

      // Verificar que no exista ya un registro para esta semana
      const existing = await WeeklyAttendance.findOne({
        where: { church_id: churchId, week_date },
      });
      if (existing) {
        return res.status(409).json({ message: 'Ya existe un registro para esta fecha. Edítelo en su lugar.' });
      }

      const record = await WeeklyAttendance.create({
        church_id: churchId,
        week_date,
        attendance_count: parseInt(attendance_count),
        notes: notes || null,
        created_by: req.user.id,
      });

      // Recalcular promedio de la iglesia
      const church = await Church.findByPk(churchId);
      const newAvg = await recalculateAvgWeeklyAttendance(church);

      res.status(201).json({
        message: 'Asistencia registrada exitosamente.',
        record,
        avg_weekly_attendance: newAvg,
      });
    } catch (error) {
      // Manejar error de duplicado (por si el unique index lo atrapa primero)
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: 'Ya existe un registro para esta fecha y esta iglesia.' });
      }
      res.status(500).json({ message: 'Error al registrar asistencia.', error: error.message });
    }
  },

  /**
   * PUT /api/weekly-attendance/:id
   * Actualizar un registro existente.
   * Recalcula el promedio automáticamente.
   */
  async update(req, res) {
    try {
      const record = await WeeklyAttendance.findByPk(req.params.id);
      if (!record) {
        return res.status(404).json({ message: 'Registro no encontrado.' });
      }

      // Verificar que pertenezca a la iglesia del usuario
      if (record.church_id !== req.user.church_id && req.user.role.name !== 'Administrador') {
        return res.status(403).json({ message: 'No tiene permiso para editar este registro.' });
      }

      const { week_date, attendance_count, notes } = req.body;

      // Si cambia la fecha, verificar que no exista duplicado
      if (week_date && week_date !== record.week_date) {
        const existing = await WeeklyAttendance.findOne({
          where: {
            church_id: record.church_id,
            week_date,
            id: { [Op.ne]: record.id }, // Excluir el registro actual
          },
        });
        if (existing) {
          return res.status(409).json({ message: 'Ya existe otro registro para esa fecha.' });
        }
      }

      await record.update({
        week_date: week_date || record.week_date,
        attendance_count: attendance_count !== undefined ? parseInt(attendance_count) : record.attendance_count,
        notes: notes !== undefined ? notes : record.notes,
      });

      // Recalcular promedio
      const church = await Church.findByPk(record.church_id);
      const newAvg = await recalculateAvgWeeklyAttendance(church);

      res.json({
        message: 'Registro actualizado exitosamente.',
        record,
        avg_weekly_attendance: newAvg,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar registro.', error: error.message });
    }
  },

  /**
   * DELETE /api/weekly-attendance/:id
   * Eliminar un registro. Recalcula el promedio automáticamente.
   */
  async delete(req, res) {
    try {
      const record = await WeeklyAttendance.findByPk(req.params.id);
      if (!record) {
        return res.status(404).json({ message: 'Registro no encontrado.' });
      }

      // Verificar permisos
      if (record.church_id !== req.user.church_id && req.user.role.name !== 'Administrador') {
        return res.status(403).json({ message: 'No tiene permiso para eliminar este registro.' });
      }

      const churchId = record.church_id;
      await record.destroy();

      // Recalcular promedio
      const church = await Church.findByPk(churchId);
      const newAvg = await recalculateAvgWeeklyAttendance(church);

      res.json({
        message: 'Registro eliminado exitosamente.',
        avg_weekly_attendance: newAvg,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar registro.', error: error.message });
    }
  },
};

module.exports = weeklyAttendanceController;

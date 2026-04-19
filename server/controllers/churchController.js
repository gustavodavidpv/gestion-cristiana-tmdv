const { Church, Mission, WhiteField, Member } = require('../models');
const { isSuperAdmin } = require('../middleware/auth');
const { sequelize } = require('../config/database');

const churchController = {
  /**
   * GET /api/churches/stats/dashboard?year=YYYY
   *
   * Endpoint exclusivo para SuperAdmin.
   * Retorna estadísticas agregadas de TODAS las iglesias para el dashboard.
   *
   * Estadísticas por iglesia:
   * - membership_count: del modelo Church (NO filtrado por año)
   * - events_count: cantidad de eventos del año
   * - minutes_count: cantidad de actas del año
   * - faith_decisions: decisiones de fe del año
   * - avg_weekly_attendance: promedio de asistencia semanal del año
   * - ordained_preachers, unordained_preachers: del modelo Church (no filtrado)
   * - ordained_deacons, unordained_deacons: del modelo Church (no filtrado)
   */
  async getDashboardStats(req, res) {
    try {
      // Solo SuperAdmin puede acceder
      if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ message: 'Acceso denegado.' });
      }

      const year = parseInt(req.query.year) || new Date().getFullYear();
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31 23:59:59`;

      // Query única con LEFT JOINs para eficiencia (evita N+1)
      const stats = await sequelize.query(`
        SELECT
          c.id,
          c.name,
          c.responsible,
          c.membership_count,
          c.ordained_preachers,
          c.unordained_preachers,
          c.ordained_deacons,
          c.unordained_deacons,
          COALESCE(ev.events_count, 0) AS events_count,
          COALESCE(mn.minutes_count, 0) AS minutes_count,
          COALESCE(fd.faith_decisions, 0) AS faith_decisions,
          COALESCE(wa.avg_attendance, 0) AS avg_weekly_attendance
        FROM churches c
        LEFT JOIN (
          SELECT church_id, COUNT(*) AS events_count
          FROM events
          WHERE start_date BETWEEN :startOfYear AND :endOfYear
          GROUP BY church_id
        ) ev ON ev.church_id = c.id
        LEFT JOIN (
          SELECT church_id, COUNT(*) AS minutes_count
          FROM minutes
          WHERE meeting_date BETWEEN :startDate AND :endDate
          GROUP BY church_id
        ) mn ON mn.church_id = c.id
        LEFT JOIN (
          SELECT e.church_id, COUNT(*) AS faith_decisions
          FROM event_attendees ea
          JOIN events e ON ea.event_id = e.id
          WHERE ea.made_faith_decision = true
            AND e.start_date BETWEEN :startOfYear AND :endOfYear
          GROUP BY e.church_id
        ) fd ON fd.church_id = c.id
        LEFT JOIN (
          SELECT church_id, ROUND(AVG(attendance_count)) AS avg_attendance
          FROM weekly_attendances
          WHERE week_date BETWEEN :startDate AND :endDate
          GROUP BY church_id
        ) wa ON wa.church_id = c.id
        ORDER BY c.name ASC
      `, {
        replacements: {
          startOfYear,
          endOfYear,
          startDate: startOfYear,
          endDate: `${year}-12-31`,
        },
        type: sequelize.QueryTypes.SELECT,
      });

      // Parsear valores numéricos (PostgreSQL retorna strings en raw queries)
      const parsedStats = stats.map((row) => ({
        id: row.id,
        name: row.name,
        responsible: row.responsible,
        membership_count: parseInt(row.membership_count) || 0,
        events_count: parseInt(row.events_count) || 0,
        minutes_count: parseInt(row.minutes_count) || 0,
        faith_decisions: parseInt(row.faith_decisions) || 0,
        avg_weekly_attendance: parseInt(row.avg_weekly_attendance) || 0,
        ordained_preachers: parseInt(row.ordained_preachers) || 0,
        unordained_preachers: parseInt(row.unordained_preachers) || 0,
        ordained_deacons: parseInt(row.ordained_deacons) || 0,
        unordained_deacons: parseInt(row.unordained_deacons) || 0,
      }));

      res.json({ stats: parsedStats, year });
    } catch (error) {
      console.error('[DASHBOARD STATS] Error:', error.message);
      res.status(500).json({ message: 'Error al obtener estadísticas del dashboard.', error: error.message });
    }
  },

  /**
   * GET /api/churches/my/summary?year=YYYY
   *
   * Endpoint ligero para el dashboard de usuarios NO SuperAdmin.
   * Protegido por el permiso `dashboard.view` (no requiere `churches.view`),
   * para que roles que solo ven el dashboard puedan obtener la cantidad de
   * decisiones de fe del año sin necesidad de acceder al recurso completo
   * de la iglesia.
   *
   * Retorna:
   * - church_id, church_name
   * - year consultado y año de referencia
   * - faith_decisions: decisiones de fe del año seleccionado (calculado dinámicamente)
   * - avg_weekly_attendance: promedio de asistencia semanal del año
   * - events_count, minutes_count: conteos del año
   */
  async getMySummary(req, res) {
    try {
      // El usuario debe pertenecer a una iglesia (SuperAdmin usa otro endpoint)
      if (!req.user?.church_id) {
        return res.status(400).json({ message: 'El usuario no está asignado a una iglesia.' });
      }

      // Año consultado: query param o año actual como default
      const currentYear = new Date().getFullYear();
      const year = parseInt(req.query.year) || currentYear;

      // Validación básica del año (evita rangos extremos maliciosos)
      if (year < 2000 || year > currentYear + 1) {
        return res.status(400).json({ message: 'Año fuera de rango válido.' });
      }

      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31 23:59:59`;
      const endDateOnly = `${year}-12-31`;

      // Query única con LEFT JOINs para calcular todas las métricas del año
      // filtradas a la iglesia del usuario
      const [row] = await sequelize.query(`
        SELECT
          c.id AS church_id,
          c.name AS church_name,
          COALESCE(ev.events_count, 0)      AS events_count,
          COALESCE(mn.minutes_count, 0)     AS minutes_count,
          COALESCE(fd.faith_decisions, 0)   AS faith_decisions,
          COALESCE(wa.avg_attendance, 0)    AS avg_weekly_attendance
        FROM churches c
        LEFT JOIN (
          SELECT church_id, COUNT(*) AS events_count
          FROM events
          WHERE start_date BETWEEN :startOfYear AND :endOfYear
            AND church_id = :churchId
          GROUP BY church_id
        ) ev ON ev.church_id = c.id
        LEFT JOIN (
          SELECT church_id, COUNT(*) AS minutes_count
          FROM minutes
          WHERE meeting_date BETWEEN :startDate AND :endDate
            AND church_id = :churchId
          GROUP BY church_id
        ) mn ON mn.church_id = c.id
        LEFT JOIN (
          SELECT e.church_id, COUNT(*) AS faith_decisions
          FROM event_attendees ea
          JOIN events e ON ea.event_id = e.id
          WHERE ea.made_faith_decision = true
            AND e.start_date BETWEEN :startOfYear AND :endOfYear
            AND e.church_id = :churchId
          GROUP BY e.church_id
        ) fd ON fd.church_id = c.id
        LEFT JOIN (
          SELECT church_id, ROUND(AVG(attendance_count)) AS avg_attendance
          FROM weekly_attendances
          WHERE week_date BETWEEN :startDate AND :endDate
            AND church_id = :churchId
          GROUP BY church_id
        ) wa ON wa.church_id = c.id
        WHERE c.id = :churchId
      `, {
        replacements: {
          churchId: req.user.church_id,
          startOfYear,
          endOfYear,
          startDate: startOfYear,
          endDate: endDateOnly,
        },
        type: sequelize.QueryTypes.SELECT,
      });

      if (!row) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      // Normalizar valores numéricos (pg retorna strings en raw queries)
      return res.json({
        church_id: row.church_id,
        church_name: row.church_name,
        year,
        faith_decisions_ref_year: year,
        faith_decisions: parseInt(row.faith_decisions) || 0,
        avg_weekly_attendance: parseInt(row.avg_weekly_attendance) || 0,
        events_count: parseInt(row.events_count) || 0,
        minutes_count: parseInt(row.minutes_count) || 0,
      });
    } catch (error) {
      console.error('[MY SUMMARY] Error:', error.message);
      return res.status(500).json({
        message: 'Error al obtener el resumen de la iglesia.',
        error: error.message,
      });
    }
  },

  // GET /api/churches
  // SuperAdmin: lista todas. Admin: solo su iglesia.
  async getAll(req, res) {
    try {
      const where = {};

      // Admin solo ve su iglesia; SuperAdmin ve todas
      if (!isSuperAdmin(req.user) && req.user.church_id) {
        where.id = req.user.church_id;
      }

      const churches = await Church.findAll({
        where,
        order: [['name', 'ASC']],
      });
      res.json({ churches });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener iglesias.', error: error.message });
    }
  },

  // GET /api/churches/:id
  async getById(req, res) {
    try {
      const church = await Church.findByPk(req.params.id, {
        include: [
          {
            model: Mission,
            as: 'missions',
            include: [{ model: Member, as: 'responsible', attributes: ['id', 'first_name', 'last_name'] }],
          },
          {
            model: WhiteField,
            as: 'white_fields',
            include: [{ model: Member, as: 'responsible', attributes: ['id', 'first_name', 'last_name'] }],
          },
        ],
      });

      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      // Admin solo puede ver su propia iglesia
      if (!isSuperAdmin(req.user) && req.user.church_id !== church.id) {
        return res.status(403).json({ message: 'No tienes acceso a esta iglesia.' });
      }

      res.json({ church });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener iglesia.', error: error.message });
    }
  },

  // POST /api/churches — Solo SuperAdmin puede crear iglesias
  async create(req, res) {
    try {
      const church = await Church.create(req.body);
      res.status(201).json({ message: 'Iglesia creada exitosamente.', church });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear iglesia.', error: error.message });
    }
  },

  /**
   * PUT /api/churches/:id
   * Admin: solo su iglesia. SuperAdmin: cualquiera.
   * Campos calculados se protegen (no editables manualmente).
   */
  async update(req, res) {
    try {
      const church = await Church.findByPk(req.params.id);
      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      // Admin solo puede editar su propia iglesia
      if (!isSuperAdmin(req.user) && req.user.church_id !== church.id) {
        return res.status(403).json({ message: 'No tienes acceso a esta iglesia.' });
      }

      // Proteger campos calculados automáticamente
      const updateData = { ...req.body };
      delete updateData.faith_decisions_year;
      delete updateData.faith_decisions_ref_year;
      delete updateData.avg_weekly_attendance;
      delete updateData.ordained_preachers;
      delete updateData.unordained_preachers;
      delete updateData.ordained_deacons;
      delete updateData.unordained_deacons;
      delete updateData.membership_count;

      await church.update(updateData);
      res.json({ message: 'Iglesia actualizada exitosamente.', church });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar iglesia.', error: error.message });
    }
  },

  // DELETE /api/churches/:id — Solo SuperAdmin
  async delete(req, res) {
    try {
      const church = await Church.findByPk(req.params.id);
      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      await church.destroy();
      res.json({ message: 'Iglesia eliminada exitosamente.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar iglesia.', error: error.message });
    }
  },

  // =========== MISIONES ===========
  async createMission(req, res) {
    try {
      const mission = await Mission.create({ ...req.body, church_id: req.params.id });
      res.status(201).json({ message: 'Misión creada exitosamente.', mission });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear misión.', error: error.message });
    }
  },

  async updateMission(req, res) {
    try {
      const mission = await Mission.findByPk(req.params.missionId);
      if (!mission) return res.status(404).json({ message: 'Misión no encontrada.' });
      await mission.update(req.body);
      res.json({ message: 'Misión actualizada.', mission });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar misión.', error: error.message });
    }
  },

  async deleteMission(req, res) {
    try {
      const mission = await Mission.findByPk(req.params.missionId);
      if (!mission) return res.status(404).json({ message: 'Misión no encontrada.' });
      await mission.destroy();
      res.json({ message: 'Misión eliminada.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar misión.', error: error.message });
    }
  },

  // =========== CAMPOS BLANCOS ===========
  async createWhiteField(req, res) {
    try {
      const whiteField = await WhiteField.create({ ...req.body, church_id: req.params.id });
      res.status(201).json({ message: 'Campo blanco creado exitosamente.', whiteField });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear campo blanco.', error: error.message });
    }
  },

  async updateWhiteField(req, res) {
    try {
      const field = await WhiteField.findByPk(req.params.fieldId);
      if (!field) return res.status(404).json({ message: 'Campo blanco no encontrado.' });
      await field.update(req.body);
      res.json({ message: 'Campo blanco actualizado.', whiteField: field });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar campo blanco.', error: error.message });
    }
  },

  async deleteWhiteField(req, res) {
    try {
      const field = await WhiteField.findByPk(req.params.fieldId);
      if (!field) return res.status(404).json({ message: 'Campo blanco no encontrado.' });
      await field.destroy();
      res.json({ message: 'Campo blanco eliminado.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar campo blanco.', error: error.message });
    }
  },
};

module.exports = churchController;

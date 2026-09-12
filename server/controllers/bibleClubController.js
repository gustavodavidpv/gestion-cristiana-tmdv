/**
 * bibleClubController.js - Club Bíblico (sección de adolescentes)
 *
 * Maneja tres recursos:
 *  - Grupos/salones (ej: "Salón A") con sus niveles configurables
 *  - Estudiantes de cada grupo
 *  - Movimientos de puntos (ganados, canjes y ajustes)
 *
 * El saldo nunca se almacena: se calcula sumando los movimientos, así el
 * historial y el saldo mostrado siempre cuadran.
 *
 * Admin: solo su iglesia. SuperAdmin: cualquier iglesia (?church_id=).
 */
const { Op, fn, col, literal } = require('sequelize');
const {
  sequelize, BibleClubGroup, BibleClubStudent, BibleClubTransaction, Church, User,
} = require('../models');
const { isSuperAdmin } = require('../middleware/auth');
const { DEFAULT_LEVELS, POINT_REASONS, normalizeLevels, computeLevel } = require('../config/bibleClub');

/** Resuelve la iglesia sobre la que opera el request (SuperAdmin puede elegir) */
const resolveChurchId = (req, explicit) => {
  if (isSuperAdmin(req.user)) {
    const id = explicit || req.query.church_id || req.body.church_id;
    return id ? parseInt(id, 10) : req.user.church_id;
  }
  return req.user.church_id;
};

/** Verifica que un registro pertenezca a la iglesia del usuario (SuperAdmin pasa) */
const canAccess = (req, record) => (
  isSuperAdmin(req.user) || (record && record.church_id === req.user.church_id)
);

/**
 * Agrega los totales de puntos de una lista de estudiantes en una sola query.
 * @param {number[]} studentIds
 * @returns {Promise<Object>} { [student_id]: { balance, earned, redeemed, redemptions } }
 */
const loadTotals = async (studentIds) => {
  if (!studentIds.length) return {};

  const rows = await BibleClubTransaction.findAll({
    where: { student_id: { [Op.in]: studentIds } },
    attributes: [
      'student_id',
      [fn('COALESCE', fn('SUM', col('points')), 0), 'balance'],
      [literal('COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0)'), 'earned'],
      [literal('COALESCE(SUM(CASE WHEN points < 0 THEN -points ELSE 0 END), 0)'), 'redeemed'],
      [literal("COUNT(CASE WHEN type = 'redeem' THEN 1 END)"), 'redemptions'],
    ],
    group: ['student_id'],
    raw: true,
  });

  const totals = {};
  for (const r of rows) {
    totals[r.student_id] = {
      balance: parseInt(r.balance, 10) || 0,
      earned: parseInt(r.earned, 10) || 0,
      redeemed: parseInt(r.redeemed, 10) || 0,
      redemptions: parseInt(r.redemptions, 10) || 0,
    };
  }
  return totals;
};

/** Artículos canjeados por estudiante (para la columna "Artículo canjeado") */
const loadRedeemedItems = async (studentIds) => {
  if (!studentIds.length) return {};
  const rows = await BibleClubTransaction.findAll({
    where: { student_id: { [Op.in]: studentIds }, type: 'redeem' },
    attributes: ['student_id', 'item', 'activity_date'],
    order: [['activity_date', 'DESC'], ['id', 'DESC']],
    raw: true,
  });
  const items = {};
  for (const r of rows) {
    if (!items[r.student_id]) items[r.student_id] = [];
    if (r.item) items[r.student_id].push({ item: r.item, date: r.activity_date });
  }
  return items;
};

const bibleClubController = {
  // =========================================================
  // GRUPOS
  // =========================================================

  // GET /api/bible-club/groups
  async getGroups(req, res) {
    try {
      const churchId = resolveChurchId(req);
      const where = {};
      if (churchId) where.church_id = churchId;

      const groups = await BibleClubGroup.findAll({
        where,
        include: [{ model: Church, as: 'church', attributes: ['id', 'name'] }],
        order: [['name', 'ASC']],
      });

      // Conteo de participantes activos por grupo
      const counts = groups.length ? await BibleClubStudent.findAll({
        where: { group_id: { [Op.in]: groups.map((g) => g.id) }, is_active: true },
        attributes: ['group_id', [fn('COUNT', col('id')), 'total']],
        group: ['group_id'],
        raw: true,
      }) : [];
      const countMap = {};
      for (const c of counts) countMap[c.group_id] = parseInt(c.total, 10) || 0;

      res.json({
        groups: groups.map((g) => ({
          ...g.toJSON(),
          levels: normalizeLevels(g.levels),
          students_count: countMap[g.id] || 0,
        })),
        default_levels: DEFAULT_LEVELS,
        reasons: POINT_REASONS,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener grupos del club.', error: error.message });
    }
  },

  // POST /api/bible-club/groups
  async createGroup(req, res) {
    try {
      const { name, description, teacher, levels } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'El nombre del grupo es requerido.' });
      }

      const group = await BibleClubGroup.create({
        church_id: resolveChurchId(req),
        name: name.trim(),
        description: description || null,
        teacher: teacher || null,
        levels: levels ? normalizeLevels(levels) : null,
        is_active: true,
      });

      res.status(201).json({ message: 'Grupo creado exitosamente.', group });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear grupo.', error: error.message });
    }
  },

  // PUT /api/bible-club/groups/:id
  async updateGroup(req, res) {
    try {
      const group = await BibleClubGroup.findByPk(req.params.id);
      if (!group) return res.status(404).json({ message: 'Grupo no encontrado.' });
      if (!canAccess(req, group)) return res.status(403).json({ message: 'No tienes acceso a este grupo.' });

      const { name, description, teacher, levels, is_active } = req.body;
      await group.update({
        name: name !== undefined ? name.trim() : group.name,
        description: description !== undefined ? description : group.description,
        teacher: teacher !== undefined ? teacher : group.teacher,
        levels: levels !== undefined ? (levels ? normalizeLevels(levels) : null) : group.levels,
        is_active: is_active !== undefined ? is_active : group.is_active,
      });

      res.json({ message: 'Grupo actualizado exitosamente.', group });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar grupo.', error: error.message });
    }
  },

  // DELETE /api/bible-club/groups/:id
  async deleteGroup(req, res) {
    try {
      const group = await BibleClubGroup.findByPk(req.params.id);
      if (!group) return res.status(404).json({ message: 'Grupo no encontrado.' });
      if (!canAccess(req, group)) return res.status(403).json({ message: 'No tienes acceso a este grupo.' });

      const students = await BibleClubStudent.count({ where: { group_id: group.id } });
      if (students > 0) {
        return res.status(400).json({
          message: `No se puede eliminar: el grupo tiene ${students} participante(s). Desactívalo o mueve los participantes primero.`,
        });
      }

      await group.destroy();
      res.json({ message: 'Grupo eliminado exitosamente.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar grupo.', error: error.message });
    }
  },

  // =========================================================
  // PARTICIPANTES (con saldo, nivel y canjes calculados)
  // =========================================================

  // GET /api/bible-club/students?group_id=&include_inactive=
  async getStudents(req, res) {
    try {
      const churchId = resolveChurchId(req);
      const { group_id, include_inactive } = req.query;

      const where = {};
      if (churchId) where.church_id = churchId;
      if (group_id) where.group_id = parseInt(group_id, 10);
      if (include_inactive !== 'true') where.is_active = true;

      const students = await BibleClubStudent.findAll({
        where,
        include: [{ model: BibleClubGroup, as: 'group', attributes: ['id', 'name', 'levels'] }],
        order: [['full_name', 'ASC']],
      });

      const ids = students.map((s) => s.id);
      const [totals, items] = await Promise.all([loadTotals(ids), loadRedeemedItems(ids)]);

      const enriched = students.map((s) => {
        const t = totals[s.id] || { balance: 0, earned: 0, redeemed: 0, redemptions: 0 };
        const level = computeLevel(t.earned, s.group?.levels);
        return {
          ...s.toJSON(),
          balance: t.balance,
          earned: t.earned,
          redeemed: t.redeemed,
          redemptions: t.redemptions,
          level,
          items: items[s.id] || [],
        };
      });

      // Ranking por saldo descendente (igual que la hoja "Saldo por participante")
      enriched.sort((a, b) => b.balance - a.balance || a.full_name.localeCompare(b.full_name));

      res.json({ students: enriched });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener participantes.', error: error.message });
    }
  },

  // POST /api/bible-club/students
  async createStudent(req, res) {
    try {
      const { full_name, group_id, phone, notes, initial_points } = req.body;
      if (!full_name || !full_name.trim()) {
        return res.status(400).json({ message: 'El nombre del participante es requerido.' });
      }
      if (!group_id) {
        return res.status(400).json({ message: 'Debe seleccionar un grupo.' });
      }

      const group = await BibleClubGroup.findByPk(group_id);
      if (!group) return res.status(404).json({ message: 'Grupo no encontrado.' });
      if (!canAccess(req, group)) return res.status(403).json({ message: 'No tienes acceso a este grupo.' });

      const student = await BibleClubStudent.create({
        church_id: group.church_id,
        group_id: group.id,
        full_name: full_name.trim(),
        phone: phone || null,
        notes: notes || null,
        is_active: true,
      });

      // Saldo inicial opcional (para participantes que ya traían puntos acumulados)
      const initial = parseInt(initial_points, 10);
      if (Number.isFinite(initial) && initial !== 0) {
        await BibleClubTransaction.create({
          student_id: student.id,
          church_id: group.church_id,
          type: 'adjust',
          points: initial,
          activity_date: new Date().toISOString().split('T')[0],
          reason: 'Saldo inicial',
          created_by: req.user.id,
        });
      }

      res.status(201).json({ message: 'Participante agregado.', student });
    } catch (error) {
      res.status(500).json({ message: 'Error al agregar participante.', error: error.message });
    }
  },

  // PUT /api/bible-club/students/:id
  async updateStudent(req, res) {
    try {
      const student = await BibleClubStudent.findByPk(req.params.id);
      if (!student) return res.status(404).json({ message: 'Participante no encontrado.' });
      if (!canAccess(req, student)) return res.status(403).json({ message: 'No tienes acceso a este participante.' });

      const { full_name, group_id, phone, notes, is_active } = req.body;

      // Cambio de grupo: validar que el grupo destino sea accesible
      if (group_id && group_id !== student.group_id) {
        const group = await BibleClubGroup.findByPk(group_id);
        if (!group) return res.status(404).json({ message: 'Grupo destino no encontrado.' });
        if (!canAccess(req, group)) return res.status(403).json({ message: 'No tienes acceso al grupo destino.' });
      }

      await student.update({
        full_name: full_name !== undefined ? full_name.trim() : student.full_name,
        group_id: group_id !== undefined ? group_id : student.group_id,
        phone: phone !== undefined ? phone : student.phone,
        notes: notes !== undefined ? notes : student.notes,
        is_active: is_active !== undefined ? is_active : student.is_active,
      });

      res.json({ message: 'Participante actualizado.', student });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar participante.', error: error.message });
    }
  },

  // DELETE /api/bible-club/students/:id — borra también su historial de puntos
  async deleteStudent(req, res) {
    try {
      const student = await BibleClubStudent.findByPk(req.params.id);
      if (!student) return res.status(404).json({ message: 'Participante no encontrado.' });
      if (!canAccess(req, student)) return res.status(403).json({ message: 'No tienes acceso a este participante.' });

      await sequelize.transaction(async (t) => {
        await BibleClubTransaction.destroy({ where: { student_id: student.id }, transaction: t });
        await student.destroy({ transaction: t });
      });

      res.json({ message: 'Participante eliminado.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar participante.', error: error.message });
    }
  },

  // =========================================================
  // MOVIMIENTOS DE PUNTOS
  // =========================================================

  // GET /api/bible-club/students/:id/transactions
  async getTransactions(req, res) {
    try {
      const student = await BibleClubStudent.findByPk(req.params.id);
      if (!student) return res.status(404).json({ message: 'Participante no encontrado.' });
      if (!canAccess(req, student)) return res.status(403).json({ message: 'No tienes acceso a este participante.' });

      const transactions = await BibleClubTransaction.findAll({
        where: { student_id: student.id },
        include: [{ model: User, as: 'creator', attributes: ['id', 'full_name'] }],
        order: [['activity_date', 'DESC'], ['id', 'DESC']],
      });

      res.json({ transactions });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener el historial.', error: error.message });
    }
  },

  // GET /api/bible-club/transactions?group_id=&date=&from=&to=
  async getGroupTransactions(req, res) {
    try {
      const churchId = resolveChurchId(req);
      const { group_id, date, from, to, limit } = req.query;

      const where = {};
      if (churchId) where.church_id = churchId;
      if (date) where.activity_date = date;
      else if (from && to) where.activity_date = { [Op.between]: [from, to] };

      const include = [{
        model: BibleClubStudent,
        as: 'student',
        attributes: ['id', 'full_name', 'group_id'],
        ...(group_id ? { where: { group_id: parseInt(group_id, 10) } } : {}),
      }];

      const transactions = await BibleClubTransaction.findAll({
        where,
        include,
        order: [['activity_date', 'DESC'], ['id', 'DESC']],
        limit: limit ? parseInt(limit, 10) : 200,
      });

      res.json({ transactions });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener movimientos.', error: error.message });
    }
  },

  /**
   * POST /api/bible-club/transactions
   * Registra uno o varios movimientos en un solo envío (hoja de asistencia).
   * Body: { activity_date, entries: [{ student_id, points, type, reason, item, notes }] }
   */
  async createTransactions(req, res) {
    try {
      const { activity_date, entries } = req.body;

      if (!activity_date) {
        return res.status(400).json({ message: 'La fecha es requerida.' });
      }
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ message: 'Debe registrar al menos un movimiento.' });
      }

      // Validar que todos los participantes existan y sean accesibles
      const ids = [...new Set(entries.map((e) => parseInt(e.student_id, 10)).filter(Boolean))];
      const students = await BibleClubStudent.findAll({ where: { id: { [Op.in]: ids } } });
      if (students.length !== ids.length) {
        return res.status(404).json({ message: 'Uno o más participantes no existen.' });
      }
      const studentMap = {};
      for (const s of students) {
        if (!canAccess(req, s)) {
          return res.status(403).json({ message: 'No tienes acceso a uno de los participantes.' });
        }
        studentMap[s.id] = s;
      }

      const rows = [];
      for (const entry of entries) {
        const points = parseInt(entry.points, 10);
        if (!Number.isFinite(points) || points === 0) continue; // ignorar filas vacías

        const type = entry.type || (points < 0 ? 'redeem' : 'earn');
        const student = studentMap[parseInt(entry.student_id, 10)];
        if (!student) continue;

        rows.push({
          student_id: student.id,
          church_id: student.church_id,
          type,
          // 'redeem' siempre descuenta, sin importar el signo que envíe la UI
          points: type === 'redeem' ? -Math.abs(points) : points,
          activity_date,
          reason: entry.reason || null,
          item: entry.item || null,
          notes: entry.notes || null,
          created_by: req.user.id,
        });
      }

      if (!rows.length) {
        return res.status(400).json({ message: 'No hay movimientos con puntos válidos.' });
      }

      const created = await BibleClubTransaction.bulkCreate(rows);
      res.status(201).json({
        message: `${created.length} movimiento(s) registrado(s).`,
        transactions: created,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al registrar puntos.', error: error.message });
    }
  },

  // PUT /api/bible-club/transactions/:id
  async updateTransaction(req, res) {
    try {
      const tx = await BibleClubTransaction.findByPk(req.params.id);
      if (!tx) return res.status(404).json({ message: 'Movimiento no encontrado.' });
      if (!canAccess(req, tx)) return res.status(403).json({ message: 'No tienes acceso a este movimiento.' });

      const { points, activity_date, reason, item, notes, type } = req.body;
      const newType = type !== undefined ? type : tx.type;
      let newPoints = points !== undefined ? parseInt(points, 10) : tx.points;
      if (!Number.isFinite(newPoints)) {
        return res.status(400).json({ message: 'Los puntos deben ser un número.' });
      }
      if (newType === 'redeem') newPoints = -Math.abs(newPoints);

      await tx.update({
        type: newType,
        points: newPoints,
        activity_date: activity_date !== undefined ? activity_date : tx.activity_date,
        reason: reason !== undefined ? reason : tx.reason,
        item: item !== undefined ? item : tx.item,
        notes: notes !== undefined ? notes : tx.notes,
      });

      res.json({ message: 'Movimiento actualizado.', transaction: tx });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar movimiento.', error: error.message });
    }
  },

  // DELETE /api/bible-club/transactions/:id
  async deleteTransaction(req, res) {
    try {
      const tx = await BibleClubTransaction.findByPk(req.params.id);
      if (!tx) return res.status(404).json({ message: 'Movimiento no encontrado.' });
      if (!canAccess(req, tx)) return res.status(403).json({ message: 'No tienes acceso a este movimiento.' });

      await tx.destroy();
      res.json({ message: 'Movimiento eliminado.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar movimiento.', error: error.message });
    }
  },
};

module.exports = bibleClubController;

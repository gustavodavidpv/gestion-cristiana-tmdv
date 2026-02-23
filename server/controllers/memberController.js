const { Member, Church, MinisterialPosition } = require('../models');
const { Op } = require('sequelize');
const { recalculateChurchRoleCounts, recalculateMembershipCount } = require('../utils/churchStats');
const { isSuperAdmin, applyTenantFilter } = require('../middleware/auth');

/**
 * Sanitiza campos opcionales del formulario de miembro.
 * 
 * El frontend envía strings vacíos '' para campos no llenados,
 * pero el modelo espera null (no '') para campos como:
 * - age (INTEGER): '' causa error de tipo en PostgreSQL
 * - sex (CHAR): '' no pasa la validación isIn(['M','F'])
 * - birth_date (DATEONLY): '' causa error de tipo
 * - phone, email, address: '' → null por consistencia
 * 
 * @param {Object} data - Datos del formulario (req.body)
 * @returns {Object} Datos con strings vacíos convertidos a null
 */
function sanitizeMemberData(data) {
  const sanitized = { ...data };

  // Campos que deben ser null si vienen como string vacío
  const nullableFields = [
    'age', 'sex', 'birth_date', 'phone', 'email', 'address',
    'church_role', 'position_id', 'photo_url',
  ];

  nullableFields.forEach((field) => {
    if (sanitized[field] === '' || sanitized[field] === undefined) {
      sanitized[field] = null;
    }
  });

  // age: convertir a entero si viene como string numérico
  if (sanitized.age !== null && sanitized.age !== undefined) {
    const parsed = parseInt(sanitized.age, 10);
    sanitized.age = isNaN(parsed) ? null : parsed;
  }

  // position_id: convertir a entero si viene como string numérico
  if (sanitized.position_id !== null && sanitized.position_id !== undefined) {
    const parsed = parseInt(sanitized.position_id, 10);
    sanitized.position_id = isNaN(parsed) ? null : parsed;
  }

  return sanitized;
}

/**
 * Auto-sincroniza el campo church_role desde position_id.
 * 
 * Cuando un miembro tiene position_id asignado, busca el nombre del cargo
 * en ministerial_positions y lo copia a church_role. Esto permite que las
 * estadísticas de la iglesia (ordained_preachers, unordained_preachers, etc.)
 * sigan funcionando correctamente porque leen desde church_role.
 * 
 * Si position_id es null (sin cargo), church_role también se pone en null.
 * 
 * @param {Object} data - Datos sanitizados del miembro
 * @returns {Object} Datos con church_role sincronizado
 */
async function syncChurchRoleFromPosition(data) {
  if (data.position_id) {
    try {
      const position = await MinisterialPosition.findByPk(data.position_id);
      if (position) {
        // Copiar el nombre del cargo al campo church_role
        // Así las estadísticas siguen leyendo desde church_role
        data.church_role = position.name;
      }
    } catch (err) {
      console.error('[SYNC] Error al sincronizar church_role desde position_id:', err.message);
    }
  } else {
    // Si no tiene cargo asignado, limpiar church_role
    data.church_role = null;
  }
  return data;
}

const memberController = {
  // GET /api/members?church_id=X&search=Y&member_type=Z&church_role=W
  async getAll(req, res) {
    try {
      const { church_id, member_type, church_role, position_id, baptized, search, page = 1, limit = 20 } = req.query;

      const where = {};
      if (church_id) where.church_id = church_id;
      if (member_type) where.member_type = member_type;
      if (church_role) where.church_role = church_role;
      if (position_id) where.position_id = position_id;
      if (baptized !== undefined) where.baptized = baptized === 'true';
      if (search) {
        where[Op.or] = [
          { first_name: { [Op.iLike]: `%${search}%` } },
          { last_name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ];
      }

      // Tenant filtering: SuperAdmin ve todo, otros su iglesia
      applyTenantFilter(where, req.user);

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows: members, count: total } = await Member.findAndCountAll({
        where,
        include: [
          { model: Church, as: 'church', attributes: ['id', 'name'] },
          { model: MinisterialPosition, as: 'position', attributes: ['id', 'name'] },
        ],
        order: [['last_name', 'ASC'], ['first_name', 'ASC']],
        limit: parseInt(limit),
        offset,
      });

      res.json({
        members,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener miembros.', error: error.message });
    }
  },

  // GET /api/members/:id
  async getById(req, res) {
    try {
      const member = await Member.findByPk(req.params.id, {
        include: [
          { model: Church, as: 'church', attributes: ['id', 'name'] },
          { model: MinisterialPosition, as: 'position', attributes: ['id', 'name'] },
        ],
      });

      if (!member) {
        return res.status(404).json({ message: 'Miembro no encontrado.' });
      }

      res.json({ member });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener miembro.', error: error.message });
    }
  },

  /**
   * POST /api/members
   * Crear un nuevo miembro.
   * 
   * Flujo:
   * 1. Sanitizar datos ('' → null para campos opcionales)
   * 2. Si tiene position_id, auto-sincronizar church_role con el nombre del cargo
   * 3. Crear el miembro
   * 4. Recalcular estadísticas: membership_count + cargos ministeriales
   */
  async create(req, res) {
    try {
      // Paso 1: Sanitizar campos vacíos → null
      let data = sanitizeMemberData(req.body);

      // Asignar church_id del usuario si no viene explícito
      data.church_id = data.church_id || req.user.church_id;

      // Paso 2: Auto-sincronizar church_role desde position_id
      // Si el miembro tiene un cargo dinámico asignado, copiar el nombre
      // del cargo a church_role para que las estadísticas funcionen.
      data = await syncChurchRoleFromPosition(data);

      // Paso 3: Crear el miembro
      const member = await Member.create({
        church_id: data.church_id,
        first_name: data.first_name,
        last_name: data.last_name,
        age: data.age,
        sex: data.sex,
        birth_date: data.birth_date,
        baptized: data.baptized,
        member_type: data.member_type,
        church_role: data.church_role,
        position_id: data.position_id,
        phone: data.phone,
        email: data.email,
        address: data.address,
      });

      // Paso 4: Recalcular estadísticas de la iglesia
      try {
        const church = await Church.findByPk(member.church_id);
        if (church) {
          await recalculateMembershipCount(church);
          // Recalcular cargos si tiene church_role (ya sea legacy o sincronizado)
          if (member.church_role || member.position_id) {
            await recalculateChurchRoleCounts(church);
          }
        }
      } catch (statsErr) {
        console.error('[STATS] Error recalculando stats:', statsErr.message);
      }

      res.status(201).json({ message: 'Miembro creado exitosamente.', member });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear miembro.', error: error.message });
    }
  },

  /**
   * PUT /api/members/:id
   * Actualizar miembro.
   * 
   * Flujo:
   * 1. Sanitizar datos
   * 2. Si cambió position_id, auto-sincronizar church_role
   * 3. Actualizar el miembro
   * 4. Si cambió cargo o iglesia, recalcular estadísticas
   */
  async update(req, res) {
    try {
      const member = await Member.findByPk(req.params.id);
      if (!member) {
        return res.status(404).json({ message: 'Miembro no encontrado.' });
      }

      // Guardar valores previos para detectar cambios
      const prevChurchId = member.church_id;
      const prevRole = member.church_role;
      const prevPositionId = member.position_id;

      // Paso 1: Sanitizar campos vacíos → null
      let data = sanitizeMemberData(req.body);

      // Paso 2: Auto-sincronizar church_role desde position_id si cambió
      // Solo sincronizar si el position_id viene en el body (fue enviado por el frontend)
      if ('position_id' in req.body) {
        data = await syncChurchRoleFromPosition(data);
      }

      // Paso 3: Actualizar el miembro
      await member.update(data);

      // Paso 4: Recalcular estadísticas si cambió cargo o iglesia
      const roleChanged = prevRole !== member.church_role;
      const positionChanged = prevPositionId !== member.position_id;
      const churchChanged = prevChurchId !== member.church_id;

      if (roleChanged || positionChanged || churchChanged) {
        try {
          const currentChurch = await Church.findByPk(member.church_id);
          if (currentChurch) {
            await recalculateChurchRoleCounts(currentChurch);
            if (churchChanged) await recalculateMembershipCount(currentChurch);
          }

          // Si cambió de iglesia, recalcular también la iglesia anterior
          if (churchChanged && prevChurchId) {
            const prevChurch = await Church.findByPk(prevChurchId);
            if (prevChurch) {
              await recalculateChurchRoleCounts(prevChurch);
              await recalculateMembershipCount(prevChurch);
            }
          }
        } catch (statsErr) {
          console.error('[STATS] Error recalculando cargos:', statsErr.message);
        }
      }

      res.json({ message: 'Miembro actualizado exitosamente.', member });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar miembro.', error: error.message });
    }
  },

  /**
   * DELETE /api/members/:id
   * Recalcula membership_count y cargos ministeriales después de eliminar.
   */
  async delete(req, res) {
    try {
      const member = await Member.findByPk(req.params.id);
      if (!member) {
        return res.status(404).json({ message: 'Miembro no encontrado.' });
      }

      const churchId = member.church_id;
      // Detectar si tenía cargo (por cualquiera de los dos sistemas)
      const hadRole = !!member.church_role || !!member.position_id;

      await member.destroy();

      if (churchId) {
        try {
          const church = await Church.findByPk(churchId);
          if (church) {
            await recalculateMembershipCount(church);
            if (hadRole) await recalculateChurchRoleCounts(church);
          }
        } catch (statsErr) {
          console.error('[STATS] Error recalculando stats:', statsErr.message);
        }
      }

      res.json({ message: 'Miembro eliminado exitosamente.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar miembro.', error: error.message });
    }
  },
};

module.exports = memberController;

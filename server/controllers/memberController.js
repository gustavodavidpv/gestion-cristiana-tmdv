const { Member, Church, MinisterialPosition, MemberPosition } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
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

  // birth_date: validar formato MM-DD (ej: "03-15")
  // Si no cumple el formato, descartarlo para evitar datos inválidos
  if (sanitized.birth_date && !/^\d{2}-\d{2}$/.test(sanitized.birth_date)) {
    sanitized.birth_date = null;
  }

  return sanitized;
}

/**
 * Auto-sincroniza el campo church_role desde position_id (legacy 1:N).
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

/**
 * Auto-sincroniza church_role y position_id desde un array de position_ids (M:N).
 *
 * Usado cuando el frontend envía position_ids[] (múltiples cargos).
 * - church_role se llena con los nombres unidos por ", " para backward compat con stats
 * - position_id se mantiene con el primer cargo para backward compat con asociación 1:N
 *
 * @param {Object} data - Datos sanitizados del miembro
 * @param {number[]} positionIds - Array de IDs de cargos ministeriales
 * @returns {Object} Datos con church_role y position_id sincronizados
 */
async function syncChurchRoleFromPositions(data, positionIds) {
  if (!positionIds || positionIds.length === 0) {
    data.church_role = null;
    data.position_id = null;
    return data;
  }
  try {
    const positions = await MinisterialPosition.findAll({
      where: { id: positionIds },
      attributes: ['id', 'name'],
    });
    // Unir nombres con ", " para church_role (backward compat con stats)
    data.church_role = positions.map(p => p.name).join(', ');
    // Mantener position_id con el primer cargo (backward compat con 1:N)
    data.position_id = positionIds[0];
  } catch (err) {
    console.error('[SYNC] Error al sincronizar church_role desde position_ids:', err.message);
  }
  return data;
}

/**
 * Guarda los cargos M:N de un miembro en la tabla junction member_positions.
 * Borra las entradas existentes y crea las nuevas (REPLACE strategy).
 *
 * @param {number} memberId - ID del miembro
 * @param {number[]} positionIds - Array de IDs de cargos
 */
async function saveMemberPositions(memberId, positionIds) {
  // Eliminar cargos existentes
  await MemberPosition.destroy({ where: { member_id: memberId } });
  // Crear nuevos si hay alguno
  if (positionIds && positionIds.length > 0) {
    await MemberPosition.bulkCreate(
      positionIds.map(pid => ({ member_id: memberId, position_id: pid })),
      { ignoreDuplicates: true }
    );
  }
}

const memberController = {
  // GET /api/members?church_id=X&search=Y&member_type=Z&church_role=W&position_ids=1,2,3
  async getAll(req, res) {
    try {
      const { church_id, member_type, church_role, position_id, position_ids, baptized, search, birth_month, page = 1, limit = 20 } = req.query;

      const where = {};
      if (church_id) where.church_id = church_id;
      if (member_type) where.member_type = member_type;
      if (church_role) where.church_role = church_role;
      // Legacy: filtro por position_id único (backward compat)
      if (position_id) where.position_id = position_id;
      if (baptized !== undefined) where.baptized = baptized === 'true';
      if (search) {
        where[Op.or] = [
          { first_name: { [Op.iLike]: `%${search}%` } },
          { last_name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ];
      }

      /**
       * Filtro por mes de cumpleaños: birth_date es STRING(5) formato "MM-DD".
       * Se filtra con LIKE 'MM-%' para obtener todos los miembros del mes indicado.
       */
      if (birth_month) {
        const monthStr = birth_month.padStart(2, '0');
        where.birth_date = { [Op.like]: `${monthStr}-%` };
      }

      // Tenant filtering: SuperAdmin ve todo, otros su iglesia
      applyTenantFilter(where, req.user);

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Includes base: iglesia + cargo legacy (1:N) + cargos M:N
      const includes = [
        { model: Church, as: 'church', attributes: ['id', 'name'] },
        { model: MinisterialPosition, as: 'position', attributes: ['id', 'name'] },
        // M:N: cargos múltiples del miembro (through member_positions)
        { model: MinisterialPosition, as: 'positions', attributes: ['id', 'name'], through: { attributes: [] } },
      ];

      /**
       * Filtro multi-select por position_ids (comma-separated).
       * Usa subquery en WHERE en vez de include+JOIN para evitar conflicto
       * con el include M:N de 'positions' que también hace JOIN sobre member_positions.
       * Los ids se parsean como parseInt para prevenir SQL injection.
       */
      if (position_ids) {
        const ids = position_ids.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (ids.length > 0) {
          where.id = {
            ...(where.id || {}),
            [Op.in]: sequelize.literal(
              `(SELECT member_id FROM member_positions WHERE position_id IN (${ids.join(',')}))`
            ),
          };
        }
      }

      const { rows: members, count: total } = await Member.findAndCountAll({
        where,
        include: includes,
        // Orden alfabético por nombre (first_name) según solicitud del usuario
        order: [['first_name', 'ASC'], ['last_name', 'ASC']],
        limit: parseInt(limit),
        offset,
        distinct: true, // Evitar conteo duplicado por JOIN con junction table
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
          // M:N: cargos múltiples del miembro
          { model: MinisterialPosition, as: 'positions', attributes: ['id', 'name'], through: { attributes: [] } },
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
   * 2. Determinar cargos: acepta position_ids[] (M:N) o position_id (legacy 1:N)
   * 3. Auto-sincronizar church_role desde los cargos asignados
   * 4. Crear el miembro
   * 5. Guardar relaciones M:N en member_positions
   * 6. Recalcular estadísticas: membership_count + cargos ministeriales
   */
  async create(req, res) {
    try {
      // Paso 1: Sanitizar campos vacíos → null
      let data = sanitizeMemberData(req.body);

      // Asignar church_id del usuario si no viene explícito
      data.church_id = data.church_id || req.user.church_id;

      // Paso 2: Determinar cargos (M:N o legacy 1:N)
      const positionIds = Array.isArray(req.body.position_ids)
        ? req.body.position_ids.filter(id => id).map(id => parseInt(id, 10))
        : (data.position_id ? [data.position_id] : []);

      // Paso 3: Auto-sincronizar church_role y position_id desde los cargos
      if (positionIds.length > 0) {
        data = await syncChurchRoleFromPositions(data, positionIds);
      } else {
        data.church_role = null;
        data.position_id = null;
      }

      // Paso 4: Crear el miembro
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

      // Paso 5: Guardar relaciones M:N en member_positions
      if (positionIds.length > 0) {
        await saveMemberPositions(member.id, positionIds);
      }

      // Paso 6: Recalcular estadísticas de la iglesia
      try {
        const church = await Church.findByPk(member.church_id);
        if (church) {
          await recalculateMembershipCount(church);
          // Recalcular cargos si tiene church_role (ya sea legacy o sincronizado)
          if (member.church_role || positionIds.length > 0) {
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
   * 2. Si se enviaron position_ids[] (M:N) o position_id (legacy), sincronizar
   * 3. Actualizar el miembro
   * 4. Guardar relaciones M:N en member_positions
   * 5. Si cambió cargo o iglesia, recalcular estadísticas
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

      // Paso 2: Determinar cargos y sincronizar
      let positionIds = null; // null = no se enviaron, undefined = vacío
      if ('position_ids' in req.body) {
        // Frontend envió position_ids[] (M:N)
        positionIds = Array.isArray(req.body.position_ids)
          ? req.body.position_ids.filter(id => id).map(id => parseInt(id, 10))
          : [];
        data = await syncChurchRoleFromPositions(data, positionIds);
      } else if ('position_id' in req.body) {
        // Legacy: frontend envió position_id (1:N)
        data = await syncChurchRoleFromPosition(data);
      }

      // Paso 3: Actualizar el miembro
      await member.update(data);

      // Paso 4: Guardar relaciones M:N si se enviaron position_ids
      if (positionIds !== null) {
        await saveMemberPositions(member.id, positionIds);
      }

      // Paso 5: Recalcular estadísticas si cambió cargo o iglesia
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

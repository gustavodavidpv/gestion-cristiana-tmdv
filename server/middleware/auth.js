const jwt = require('jsonwebtoken');
const { User, Role, RolePermission } = require('../models');
const { DEFAULTS } = require('../config/permissions');

/**
 * Middleware: Verificar token JWT
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id, {
      include: [{ model: Role, as: 'role' }],
      attributes: { exclude: ['password_hash'] },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Usuario no encontrado o inactivo.' });
    }

    // Precargar permisos dinámicos para no-SuperAdmin (evita queries extra en authorizePermission)
    if (user.role.name !== 'SuperAdmin') {
      try {
        const perms = await RolePermission.findAll({
          where: { role_id: user.role_id },
          attributes: ['module', 'action', 'allowed'],
          raw: true,
        });
        user._permissions = {};
        for (const p of perms) {
          if (!user._permissions[p.module]) user._permissions[p.module] = {};
          user._permissions[p.module][p.action] = p.allowed;
        }
      } catch {
        // Si falla la carga de permisos, se usarán DEFAULTS en authorizePermission
        user._permissions = {};
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado. Inicie sesión nuevamente.' });
    }
    return res.status(401).json({ message: 'Token inválido.' });
  }
};

/**
 * Middleware: Verificar roles permitidos
 * SuperAdmin SIEMPRE tiene acceso (bypass automático).
 * @param  {...string} roles - Roles permitidos
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Acceso denegado.' });
    }

    // SuperAdmin siempre tiene acceso a todo
    if (req.user.role.name === 'SuperAdmin') {
      return next();
    }

    if (!roles.includes(req.user.role.name)) {
      return res.status(403).json({
        message: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}.`,
      });
    }

    next();
  };
};

/**
 * Middleware: Verificar que el usuario pertenece a la iglesia.
 * SuperAdmin tiene acceso a todas las iglesias (bypass tenant).
 */
const belongsToChurch = (req, res, next) => {
  const churchId = parseInt(req.params.churchId || req.params.id || req.body.church_id);

  // SuperAdmin tiene acceso a todo
  if (req.user.role.name === 'SuperAdmin') {
    return next();
  }

  // Administrador tiene acceso solo a su iglesia
  if (req.user.role.name === 'Administrador') {
    if (req.user.church_id !== churchId) {
      return res.status(403).json({
        message: 'No tienes acceso a los datos de esta iglesia.',
      });
    }
    return next();
  }

  if (req.user.church_id !== churchId) {
    return res.status(403).json({
      message: 'No tienes acceso a los datos de esta iglesia.',
    });
  }

  next();
};

/**
 * Helper: Determina si el usuario puede ver datos de todas las iglesias.
 * Solo SuperAdmin puede ver datos cross-tenant.
 * Admin está restringido a su iglesia.
 * 
 * @param {Object} user - req.user con role incluido
 * @returns {boolean} true si puede ver todo
 */
const isSuperAdmin = (user) => {
  return user && user.role && user.role.name === 'SuperAdmin';
};

/**
 * Helper: Aplica filtro de tenant (church_id) a un WHERE object.
 * SuperAdmin: no filtra (ve todo).
 * Otros roles: filtra por su church_id.
 * 
 * @param {Object} where - Objeto where de Sequelize
 * @param {Object} user - req.user
 * @returns {Object} where modificado
 */
const applyTenantFilter = (where, user) => {
  if (isSuperAdmin(user)) return where; // Sin filtro
  if (user.church_id) {
    where.church_id = user.church_id;
  }
  return where;
};

/**
 * Middleware: Verificar permiso dinámico por módulo y acción.
 * Usa los permisos precargados en authenticate() (_permissions).
 * Si no hay permisos en DB, usa DEFAULTS del config.
 * SuperAdmin SIEMPRE tiene acceso (bypass automático).
 *
 * @param {string} module - Clave del módulo (ej: 'members', 'events')
 * @param {string} action - Acción requerida (ej: 'view', 'create', 'edit', 'delete', 'attendance')
 */
const authorizePermission = (module, action) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Acceso denegado.' });
    }

    // SuperAdmin siempre tiene acceso a todo
    if (req.user.role.name === 'SuperAdmin') {
      return next();
    }

    // Chequear permisos dinámicos (precargados en authenticate)
    const perms = req.user._permissions || {};
    const allowed = perms[module]?.[action];

    if (allowed !== undefined) {
      // Hay permiso en DB: usar ese valor
      if (allowed) return next();
    } else {
      // No hay permiso en DB: fallback a DEFAULTS
      const roleDefaults = DEFAULTS[req.user.role.name];
      if (roleDefaults?.[module]?.[action]) return next();
    }

    return res.status(403).json({
      message: `Acceso denegado. Permiso requerido: ${module}.${action}.`,
    });
  };
};

module.exports = { authenticate, authorize, authorizePermission, belongsToChurch, isSuperAdmin, applyTenantFilter };

const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');

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

module.exports = { authenticate, authorize, belongsToChurch, isSuperAdmin, applyTenantFilter };

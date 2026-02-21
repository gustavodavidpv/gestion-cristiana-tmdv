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
 * @param  {...string} roles - Roles permitidos
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Acceso denegado.' });
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
 * Middleware: Verificar que el usuario pertenece a la iglesia
 */
const belongsToChurch = (req, res, next) => {
  const churchId = parseInt(req.params.churchId || req.body.church_id);

  if (req.user.role.name === 'Administrador') {
    return next(); // Admin tiene acceso a todo
  }

  if (req.user.church_id !== churchId) {
    return res.status(403).json({
      message: 'No tienes acceso a los datos de esta iglesia.',
    });
  }

  next();
};

module.exports = { authenticate, authorize, belongsToChurch };

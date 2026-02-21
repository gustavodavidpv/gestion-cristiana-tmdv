const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Role, Church } = require('../models');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role_id: user.role_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Store de tokens de reset (en producción usar Redis o BD)
const resetTokens = new Map();

const authController = {
  // POST /api/auth/register
  async register(req, res) {
    try {
      const { email, password, full_name, role_id, church_id } = req.body;

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: 'El email ya está registrado.' });
      }

      const role = await Role.findByPk(role_id);
      if (!role) {
        return res.status(400).json({ message: 'Rol no válido.' });
      }

      const user = await User.create({
        email,
        password_hash: password,
        full_name,
        role_id,
        church_id,
      });

      const token = generateToken(user);

      res.status(201).json({
        message: 'Usuario registrado exitosamente.',
        token,
        user: user.toJSON(),
      });
    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({ message: 'Error al registrar usuario.', error: error.message });
    }
  },

  // POST /api/auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({
        where: { email },
        include: [
          { model: Role, as: 'role' },
          { model: Church, as: 'church', attributes: ['id', 'name'] },
        ],
      });

      if (!user) {
        return res.status(401).json({ message: 'Credenciales incorrectas.' });
      }

      if (!user.is_active) {
        return res.status(401).json({ message: 'Cuenta desactivada. Contacte al administrador.' });
      }

      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Credenciales incorrectas.' });
      }

      const token = generateToken(user);

      res.json({
        message: 'Inicio de sesión exitoso.',
        token,
        user: user.toJSON(),
      });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ message: 'Error al iniciar sesión.', error: error.message });
    }
  },

  // GET /api/auth/me
  async getProfile(req, res) {
    try {
      const user = await User.findByPk(req.user.id, {
        include: [
          { model: Role, as: 'role' },
          { model: Church, as: 'church' },
        ],
        attributes: { exclude: ['password_hash'] },
      });

      res.json({ user });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener perfil.', error: error.message });
    }
  },

  // =============================================
  // PASSWORD RESET
  // =============================================

  // POST /api/auth/forgot-password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        // No revelar si el usuario existe o no por seguridad
        return res.json({ message: 'Si el correo está registrado, se generó un código de restablecimiento.' });
      }

      // Generar token de 6 dígitos
      const resetCode = crypto.randomInt(100000, 999999).toString();
      const expiry = Date.now() + 15 * 60 * 1000; // 15 minutos

      resetTokens.set(email, { code: resetCode, expiry, userId: user.id });

      // En producción aquí enviarías un email. Por ahora lo logueamos y lo devolvemos.
      console.log(`[RESET CODE] ${email}: ${resetCode}`);

      res.json({
        message: 'Se ha generado un código de restablecimiento.',
        // En desarrollo devolvemos el código; en producción se enviaría por email
        reset_code: process.env.NODE_ENV !== 'production' ? resetCode : undefined,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al procesar solicitud.', error: error.message });
    }
  },

  // POST /api/auth/reset-password
  async resetPassword(req, res) {
    try {
      const { email, code, new_password } = req.body;

      if (!email || !code || !new_password) {
        return res.status(400).json({ message: 'Todos los campos son requeridos.' });
      }

      if (new_password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
      }

      const resetData = resetTokens.get(email);

      if (!resetData) {
        return res.status(400).json({ message: 'No hay solicitud de restablecimiento para este correo.' });
      }

      if (Date.now() > resetData.expiry) {
        resetTokens.delete(email);
        return res.status(400).json({ message: 'El código ha expirado. Solicite uno nuevo.' });
      }

      if (resetData.code !== code) {
        return res.status(400).json({ message: 'Código incorrecto.' });
      }

      const user = await User.findByPk(resetData.userId);
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado.' });
      }

      await user.update({ password_hash: new_password });
      resetTokens.delete(email);

      res.json({ message: 'Contraseña restablecida exitosamente. Puede iniciar sesión.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al restablecer contraseña.', error: error.message });
    }
  },

  // =============================================
  // ADMIN: PASSWORD RESET FOR ANY USER
  // =============================================

  // POST /api/auth/admin-reset-password/:userId
  async adminResetPassword(req, res) {
    try {
      const { new_password } = req.body;
      const { userId } = req.params;

      if (!new_password || new_password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado.' });
      }

      await user.update({ password_hash: new_password });

      res.json({ message: `Contraseña de ${user.full_name} restablecida exitosamente.` });
    } catch (error) {
      res.status(500).json({ message: 'Error al restablecer contraseña.', error: error.message });
    }
  },
};

module.exports = authController;

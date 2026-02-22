/**
 * brandingController.js - Gestión de branding (logo + título) por iglesia
 * 
 * Endpoints:
 *   GET  /api/branding/:churchId   — Obtener branding de una iglesia (público)
 *   PUT  /api/branding/:churchId   — Actualizar título de login
 *   POST /api/branding/:churchId/logo — Subir logo de la iglesia
 * 
 * Admin: solo su iglesia. SuperAdmin: cualquier iglesia.
 */
const { Church } = require('../models');
const { isSuperAdmin } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const brandingController = {
  /**
   * GET /api/branding/:churchId
   * Retorna datos de branding de la iglesia (público, no requiere auth).
   * Usado por la pantalla de Login para mostrar logo y título.
   */
  async getBranding(req, res) {
    try {
      const church = await Church.findByPk(req.params.churchId, {
        attributes: ['id', 'name', 'login_title', 'login_logo_url'],
      });

      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      res.json({
        branding: {
          church_id: church.id,
          name: church.name,
          login_title: church.login_title || church.name,
          login_logo_url: church.login_logo_url || null,
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener branding.', error: error.message });
    }
  },

  /**
   * GET /api/branding
   * Lista branding de todas las iglesias.
   * SuperAdmin: todas. Admin: solo su iglesia.
   */
  async getAllBranding(req, res) {
    try {
      const where = {};
      if (!isSuperAdmin(req.user)) {
        where.id = req.user.church_id;
      }

      const churches = await Church.findAll({
        where,
        attributes: ['id', 'name', 'login_title', 'login_logo_url'],
        order: [['name', 'ASC']],
      });

      res.json({ churches });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener branding.', error: error.message });
    }
  },

  /**
   * PUT /api/branding/:churchId
   * Actualiza el título de login de la iglesia.
   */
  async updateBranding(req, res) {
    try {
      const church = await Church.findByPk(req.params.churchId);
      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      // Verificar acceso: Admin solo su iglesia
      if (!isSuperAdmin(req.user) && req.user.church_id !== church.id) {
        return res.status(403).json({ message: 'No tienes acceso a esta iglesia.' });
      }

      const { login_title } = req.body;
      await church.update({ login_title: login_title || null });

      res.json({
        message: 'Branding actualizado exitosamente.',
        branding: {
          church_id: church.id,
          name: church.name,
          login_title: church.login_title || church.name,
          login_logo_url: church.login_logo_url || null,
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar branding.', error: error.message });
    }
  },

  /**
   * POST /api/branding/:churchId/logo
   * Sube el logo de la iglesia (PNG/JPG).
   * Guarda en public/uploads/logos/ y actualiza login_logo_url.
   */
  async uploadLogo(req, res) {
    try {
      const church = await Church.findByPk(req.params.churchId);
      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      // Verificar acceso
      if (!isSuperAdmin(req.user) && req.user.church_id !== church.id) {
        return res.status(403).json({ message: 'No tienes acceso a esta iglesia.' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo.' });
      }

      // Si ya tenía un logo anterior, eliminarlo del disco
      if (church.login_logo_url) {
        const oldPath = path.join(__dirname, '..', 'public', church.login_logo_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      const logoUrl = `/uploads/logos/${req.file.filename}`;
      await church.update({ login_logo_url: logoUrl });

      res.json({
        message: 'Logo subido exitosamente.',
        login_logo_url: logoUrl,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al subir logo.', error: error.message });
    }
  },

  /**
   * DELETE /api/branding/:churchId/logo
   * Elimina el logo de la iglesia.
   */
  async deleteLogo(req, res) {
    try {
      const church = await Church.findByPk(req.params.churchId);
      if (!church) {
        return res.status(404).json({ message: 'Iglesia no encontrada.' });
      }

      if (!isSuperAdmin(req.user) && req.user.church_id !== church.id) {
        return res.status(403).json({ message: 'No tienes acceso a esta iglesia.' });
      }

      if (church.login_logo_url) {
        const filePath = path.join(__dirname, '..', 'public', church.login_logo_url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        await church.update({ login_logo_url: null });
      }

      res.json({ message: 'Logo eliminado exitosamente.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar logo.', error: error.message });
    }
  },
};

module.exports = brandingController;

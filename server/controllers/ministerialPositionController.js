/**
 * ministerialPositionController.js - CRUD de cargos ministeriales
 * 
 * Cada iglesia puede definir sus propios cargos.
 * Admin: solo CRUD de su iglesia.
 * SuperAdmin: CRUD de cualquier iglesia.
 */
const { MinisterialPosition, Church } = require('../models');
const { isSuperAdmin } = require('../middleware/auth');

const ministerialPositionController = {
  // GET /api/ministerial-positions
  // Lista cargos de la iglesia del usuario (o todos si SuperAdmin)
  async getAll(req, res) {
    try {
      const where = {};
      const { church_id, is_active } = req.query;

      // SuperAdmin puede filtrar por iglesia o ver todas
      if (isSuperAdmin(req.user)) {
        if (church_id) where.church_id = church_id;
      } else {
        // Admin/otros: solo su iglesia
        where.church_id = req.user.church_id;
      }

      if (is_active !== undefined) where.is_active = is_active === 'true';

      const positions = await MinisterialPosition.findAll({
        where,
        include: [{ model: Church, as: 'church', attributes: ['id', 'name'] }],
        order: [['name', 'ASC']],
      });

      res.json({ positions });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener cargos.', error: error.message });
    }
  },

  // GET /api/ministerial-positions/:id
  async getById(req, res) {
    try {
      const position = await MinisterialPosition.findByPk(req.params.id, {
        include: [{ model: Church, as: 'church', attributes: ['id', 'name'] }],
      });
      if (!position) {
        return res.status(404).json({ message: 'Cargo no encontrado.' });
      }

      // Verificar acceso tenant
      if (!isSuperAdmin(req.user) && position.church_id !== req.user.church_id) {
        return res.status(403).json({ message: 'No tienes acceso a este cargo.' });
      }

      res.json({ position });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener cargo.', error: error.message });
    }
  },

  // POST /api/ministerial-positions
  async create(req, res) {
    try {
      const { name, description, church_id } = req.body;

      // SuperAdmin puede crear para cualquier iglesia
      const targetChurchId = isSuperAdmin(req.user)
        ? (church_id || req.user.church_id)
        : req.user.church_id;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'El nombre del cargo es requerido.' });
      }

      const position = await MinisterialPosition.create({
        name: name.trim(),
        description: description || null,
        church_id: targetChurchId,
        is_active: true,
      });

      res.status(201).json({ message: 'Cargo creado exitosamente.', position });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear cargo.', error: error.message });
    }
  },

  // PUT /api/ministerial-positions/:id
  async update(req, res) {
    try {
      const position = await MinisterialPosition.findByPk(req.params.id);
      if (!position) {
        return res.status(404).json({ message: 'Cargo no encontrado.' });
      }

      // Verificar acceso tenant
      if (!isSuperAdmin(req.user) && position.church_id !== req.user.church_id) {
        return res.status(403).json({ message: 'No tienes acceso a este cargo.' });
      }

      const { name, description, is_active } = req.body;
      await position.update({
        name: name !== undefined ? name.trim() : position.name,
        description: description !== undefined ? description : position.description,
        is_active: is_active !== undefined ? is_active : position.is_active,
      });

      res.json({ message: 'Cargo actualizado exitosamente.', position });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar cargo.', error: error.message });
    }
  },

  // DELETE /api/ministerial-positions/:id
  async delete(req, res) {
    try {
      const position = await MinisterialPosition.findByPk(req.params.id);
      if (!position) {
        return res.status(404).json({ message: 'Cargo no encontrado.' });
      }

      // Verificar acceso tenant
      if (!isSuperAdmin(req.user) && position.church_id !== req.user.church_id) {
        return res.status(403).json({ message: 'No tienes acceso a este cargo.' });
      }

      await position.destroy();
      res.json({ message: 'Cargo eliminado exitosamente.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar cargo.', error: error.message });
    }
  },
};

module.exports = ministerialPositionController;

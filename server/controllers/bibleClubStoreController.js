/**
 * bibleClubStoreController.js - Tiendita del Club Bíblico
 *
 * ADMINISTRACIÓN (con sesión, permisos de bible_club):
 *  - Configuración de la página pública (título, aviso, mostrar posiciones)
 *  - Catálogo de artículos con foto, costo en puntos e inventario
 *
 * PÚBLICO (sin sesión, para compartir con los muchachos por WhatsApp):
 *  - GET /api/public/store/:code               catálogo + tabla de posiciones
 *  - GET /api/public/store/items/:id/image     foto de un artículo
 *
 * En la página pública los nombres se muestran abreviados ("Juan P."):
 * los participantes son menores de edad y el enlace puede reenviarse.
 */
const crypto = require('crypto');
const {
  BibleClubItem, BibleClubStore, BibleClubGroup, Church,
} = require('../models');
const { normalizeLevels } = require('../config/bibleClub');
const { resolveChurchId, canAccess, buildStandings } = require('./bibleClubController');

/** Tamaño máximo de una foto ya comprimida por el navegador */
const MAX_IMAGE_BYTES = 400 * 1024;

const DEFAULT_TITLE = 'Tiendita del Club Bíblico';

/** Código aleatorio para el enlace público (10 caracteres hexadecimales) */
const newPublicCode = () => crypto.randomBytes(5).toString('hex');

/** Busca la configuración de la tienda de una iglesia; la crea si no existe */
const findOrCreateStore = async (churchId) => {
  let store = await BibleClubStore.findOne({ where: { church_id: churchId } });
  if (!store) {
    store = await BibleClubStore.create({
      church_id: churchId,
      public_code: newPublicCode(),
      is_public: true,
      show_standings: true,
    });
  }
  return store;
};

/** URL de la foto con la versión para romper la caché del navegador */
const imageUrl = (item) => (
  item.image_type ? `/api/public/store/items/${item.id}/image?v=${item.image_version}` : null
);

/** Representación de un artículo para la API (nunca incluye los bytes) */
const serializeItem = (item) => {
  const { image, ...rest } = item.toJSON();
  return {
    ...rest,
    image_url: imageUrl(item),
    available: item.stock === null || item.stock > 0,
  };
};

/**
 * Convierte "data:image/jpeg;base64,..." en bytes validados.
 * Revisa la firma del archivo, no solo lo que dice el encabezado.
 * @returns {{buffer: Buffer, type: string}}
 */
const parseImage = (dataUrl) => {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl));
  if (!match) throw new Error('La foto debe ser JPG, PNG o WEBP.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new Error('La foto está vacía.');
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`La foto pesa ${Math.round(buffer.length / 1024)} KB; el máximo es ${MAX_IMAGE_BYTES / 1024} KB.`);
  }

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  const type = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : null;
  if (!type) throw new Error('El archivo no es una imagen válida.');
  return { buffer, type };
};

/** Valida y normaliza los campos editables de un artículo */
const readItemFields = (body, current = {}) => {
  const fields = {};
  if (body.name !== undefined || !current.name) {
    const name = String(body.name || '').trim();
    if (!name) throw new Error('El nombre del artículo es requerido.');
    fields.name = name.slice(0, 120);
  }
  if (body.description !== undefined) {
    fields.description = String(body.description || '').trim() || null;
  }
  if (body.points_cost !== undefined || current.points_cost === undefined) {
    const cost = parseInt(body.points_cost, 10);
    if (!Number.isFinite(cost) || cost < 1) throw new Error('El costo debe ser de al menos 1 punto.');
    fields.points_cost = cost;
  }
  if (body.stock !== undefined) {
    if (body.stock === null || body.stock === '') {
      fields.stock = null; // sin control de inventario
    } else {
      const stock = parseInt(body.stock, 10);
      if (!Number.isFinite(stock) || stock < 0) throw new Error('La cantidad disponible no puede ser negativa.');
      fields.stock = stock;
    }
  }
  if (body.is_active !== undefined) fields.is_active = !!body.is_active;
  return fields;
};

/**
 * Nombre abreviado para la página pública (los participantes son menores):
 * "Ana Pérez" → "Ana P.", "Juan Carlos Pérez González" → "Juan P.".
 */
const publicName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  // Con 3+ palabras se asume "Nombre Segundo Apellido1 ..." → inicial del primer apellido
  const surname = parts.length >= 3 ? parts[parts.length - 2] : parts[1];
  return `${parts[0]} ${surname.charAt(0).toUpperCase()}.`;
};

const sortItems = (a, b) => a.points_cost - b.points_cost || a.name.localeCompare(b.name);

const bibleClubStoreController = {
  // =========================================================
  // ADMINISTRACIÓN
  // =========================================================

  // GET /api/bible-club/store
  async getStore(req, res) {
    try {
      const churchId = resolveChurchId(req);
      if (!churchId) return res.status(400).json({ message: 'Selecciona una iglesia.' });

      const store = await findOrCreateStore(churchId);
      const items = await BibleClubItem.findAll({ where: { church_id: churchId } });

      res.json({
        store: { ...store.toJSON(), title: store.title || DEFAULT_TITLE },
        public_path: `/tienda/${store.public_code}`,
        items: items.map(serializeItem).sort(sortItems),
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener la tiendita.', error: error.message });
    }
  },

  // PUT /api/bible-club/store  Body: { title, message, is_public, show_standings, regenerate_code }
  async updateStore(req, res) {
    try {
      const churchId = resolveChurchId(req);
      if (!churchId) return res.status(400).json({ message: 'Selecciona una iglesia.' });

      const store = await findOrCreateStore(churchId);
      const { title, message, is_public, show_standings, regenerate_code } = req.body;

      await store.update({
        title: title !== undefined ? (String(title || '').trim().slice(0, 120) || null) : store.title,
        message: message !== undefined ? (String(message || '').trim() || null) : store.message,
        is_public: is_public !== undefined ? !!is_public : store.is_public,
        show_standings: show_standings !== undefined ? !!show_standings : store.show_standings,
        public_code: regenerate_code ? newPublicCode() : store.public_code,
      });

      res.json({
        message: regenerate_code ? 'Enlace nuevo generado. El anterior ya no funciona.' : 'Tiendita actualizada.',
        store: { ...store.toJSON(), title: store.title || DEFAULT_TITLE },
        public_path: `/tienda/${store.public_code}`,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar la tiendita.', error: error.message });
    }
  },

  // POST /api/bible-club/store/items  Body: { name, description, points_cost, stock, image (data URL) }
  async createItem(req, res) {
    try {
      const churchId = resolveChurchId(req);
      if (!churchId) return res.status(400).json({ message: 'Selecciona una iglesia.' });

      let fields;
      let image = null;
      try {
        fields = readItemFields(req.body);
        if (req.body.image) image = parseImage(req.body.image);
      } catch (validation) {
        return res.status(400).json({ message: validation.message });
      }

      const item = await BibleClubItem.create({
        church_id: churchId,
        stock: null,
        is_active: true,
        ...fields,
        ...(image ? { image: image.buffer, image_type: image.type, image_version: 1 } : {}),
      });

      res.status(201).json({ message: 'Artículo agregado a la tiendita.', item: serializeItem(item) });
    } catch (error) {
      res.status(500).json({ message: 'Error al agregar el artículo.', error: error.message });
    }
  },

  // PUT /api/bible-club/store/items/:id  Body: campos a cambiar; image: data URL nueva o null para quitarla
  async updateItem(req, res) {
    try {
      const item = await BibleClubItem.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: 'Artículo no encontrado.' });
      if (!canAccess(req, item)) return res.status(403).json({ message: 'No tienes acceso a este artículo.' });

      let fields;
      try {
        fields = readItemFields(req.body, item);
        if (req.body.image) {
          const image = parseImage(req.body.image);
          Object.assign(fields, {
            image: image.buffer, image_type: image.type, image_version: item.image_version + 1,
          });
        } else if (req.body.image === null) {
          Object.assign(fields, { image: null, image_type: null, image_version: item.image_version + 1 });
        }
      } catch (validation) {
        return res.status(400).json({ message: validation.message });
      }

      await item.update(fields);
      res.json({ message: 'Artículo actualizado.', item: serializeItem(item) });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar el artículo.', error: error.message });
    }
  },

  // DELETE /api/bible-club/store/items/:id — el historial de canjes conserva el nombre
  async deleteItem(req, res) {
    try {
      const item = await BibleClubItem.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: 'Artículo no encontrado.' });
      if (!canAccess(req, item)) return res.status(403).json({ message: 'No tienes acceso a este artículo.' });

      await item.destroy();
      res.json({ message: 'Artículo eliminado de la tiendita.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar el artículo.', error: error.message });
    }
  },

  // =========================================================
  // PÚBLICO (sin sesión)
  // =========================================================

  // GET /api/public/store/:code
  async getPublicStore(req, res) {
    try {
      const code = String(req.params.code || '').trim().toLowerCase();
      const store = code && await BibleClubStore.findOne({ where: { public_code: code } });
      if (!store) return res.status(404).json({ message: 'Esta tiendita no existe o el enlace cambió.' });

      const church = await Church.findByPk(store.church_id, {
        attributes: ['id', 'name', 'login_logo_url'],
      });
      const header = {
        title: store.title || DEFAULT_TITLE,
        message: store.message,
        church_name: church?.name || '',
        logo_url: church?.login_logo_url || null,
      };

      // Enlace pausado por el administrador
      if (!store.is_public) {
        return res.json({ store: { ...header, is_open: false }, items: [], groups: [] });
      }

      const items = await BibleClubItem.findAll({
        where: { church_id: store.church_id, is_active: true },
      });

      let groups = [];
      if (store.show_standings) {
        const activeGroups = await BibleClubGroup.findAll({
          where: { church_id: store.church_id, is_active: true },
          order: [['name', 'ASC']],
        });
        groups = await Promise.all(activeGroups.map(async (group) => {
          const { students, lastRound } = await buildStandings({
            churchId: store.church_id, groupId: group.id,
          });
          return {
            id: group.id,
            name: group.name,
            levels: normalizeLevels(group.levels),
            last_round_date: lastRound.date,
            students: students.map((s, idx) => ({
              position: idx + 1,
              name: publicName(s.full_name),
              balance: s.balance,
              earned: s.earned,
              last_round: s.last_round,
              level: s.level ? { name: s.level.name, color: s.level.color } : null,
            })),
          };
        }));
        groups = groups.filter((g) => g.students.length > 0);
      }

      // La página se actualiza cada vez que se abre: que nadie la guarde en caché
      res.set('Cache-Control', 'no-cache');
      res.json({
        store: { ...header, is_open: true },
        items: items.map(serializeItem).sort(sortItems).map(({
          church_id, is_active, created_at, updated_at, image_type, image_version, ...pub
        }) => pub),
        groups,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al cargar la tiendita.', error: error.message });
    }
  },

  // GET /api/public/store/items/:id/image?v=
  async getItemImage(req, res) {
    try {
      const item = await BibleClubItem.scope('withImage').findByPk(req.params.id);
      if (!item || !item.image || !item.image_type) return res.status(404).end();

      // La URL lleva la versión de la foto: si coincide, se puede guardar para siempre
      const versioned = String(req.query.v) === String(item.image_version);
      res.set('Content-Type', item.image_type);
      res.set('Cache-Control', versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
      res.set('X-Content-Type-Options', 'nosniff');
      res.send(Buffer.isBuffer(item.image) ? item.image : Buffer.from(item.image));
    } catch (error) {
      res.status(500).end();
    }
  },
};

module.exports = bibleClubStoreController;
module.exports.publicName = publicName;
module.exports.parseImage = parseImage;

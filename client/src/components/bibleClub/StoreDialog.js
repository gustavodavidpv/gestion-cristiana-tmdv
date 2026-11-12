/**
 * StoreDialog.js - Administración de la tiendita del Club Bíblico
 *
 * - Enlace público para compartir con los muchachos (copiar / WhatsApp)
 * - Ajustes de la página pública (título, aviso, mostrar posiciones)
 * - Catálogo: foto (comprimida en el navegador), nombre, costo e inventario
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { compressImage } from '../../utils/imageCompress';
import {
  Box, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Chip, Grid, Paper, Switch, FormControlLabel, CircularProgress, Alert,
  AppBar, Toolbar, Stack, InputAdornment, Divider,
} from '@mui/material';
import {
  Close as CloseIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ContentCopy as ContentCopyIcon, WhatsApp as WhatsAppIcon, OpenInNew as OpenInNewIcon,
  PhotoCamera as PhotoCameraIcon, Storefront as StorefrontIcon, Refresh as RefreshIcon,
  ImageNotSupported as NoImageIcon,
} from '@mui/icons-material';

const EMPTY_ITEM = {
  name: '', description: '', points_cost: '', track_stock: false, stock: '', is_active: true,
  image: undefined, preview: null,
};

/** Foto cuadrada del artículo, con marcador si no tiene */
export const ItemPhoto = ({ src, alt, soldOut, height = 140 }) => (
  <Box sx={{ position: 'relative', height, bgcolor: 'grey.100', overflow: 'hidden' }}>
    {src ? (
      <Box component="img" src={src} alt={alt} loading="lazy"
        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: soldOut ? 'grayscale(1)' : 'none' }} />
    ) : (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'grey.400' }}>
        <StorefrontIcon sx={{ fontSize: height / 3 }} />
      </Box>
    )}
    {soldOut && (
      <Chip label="Agotado" size="small" color="error"
        sx={{ position: 'absolute', top: 8, left: 8, fontWeight: 700 }} />
    )}
  </Box>
);

const StoreDialog = ({ open, onClose, params, isMobile, canCreate, canEdit, canDelete, onChanged }) => {
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [settings, setSettings] = useState(null);
  const [publicPath, setPublicPath] = useState('');
  const [items, setItems] = useState([]);
  const [itemDialog, setItemDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bible-club/store', { params });
      setStore(data.store);
      setSettings({
        title: data.store.title || '', message: data.store.message || '',
        is_public: data.store.is_public, show_standings: data.store.show_standings,
      });
      setPublicPath(data.public_path);
      setItems(data.items || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al cargar la tiendita');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const publicUrl = publicPath ? `${window.location.origin}${publicPath}` : '';
  const shareText = `🎁 ${settings?.title || 'Tiendita del Club Bíblico'}\nMira los premios y cuántos puntos llevas:\n${publicUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Enlace copiado');
    } catch {
      window.prompt('Copia el enlace:', publicUrl);
    }
  };

  // ===== AJUSTES =====
  const saveSettings = async (extra = {}) => {
    try {
      const { data } = await api.put('/bible-club/store', { ...settings, ...extra }, { params });
      setStore(data.store);
      setPublicPath(data.public_path);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  const regenerate = () => {
    if (!window.confirm('Se creará un enlace nuevo y el anterior dejará de funcionar. ¿Continuar?')) return;
    saveSettings({ regenerate_code: true });
  };

  // ===== ARTÍCULOS =====
  const openNewItem = () => setItemDialog({ editing: null, form: { ...EMPTY_ITEM } });
  const openEditItem = (item) => setItemDialog({
    editing: item,
    form: {
      name: item.name, description: item.description || '', points_cost: String(item.points_cost),
      track_stock: item.stock !== null, stock: item.stock !== null ? String(item.stock) : '',
      is_active: item.is_active, image: undefined, preview: item.image_url,
    },
  });
  const setForm = (patch) => setItemDialog((d) => ({ ...d, form: { ...d.form, ...patch } }));

  const pickPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // permite elegir la misma foto otra vez
    if (!file) return;
    setCompressing(true);
    try {
      const dataUrl = await compressImage(file);
      setForm({ image: dataUrl, preview: dataUrl });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCompressing(false);
    }
  };

  const saveItem = async (e) => {
    e.preventDefault();
    const { editing, form } = itemDialog;
    const payload = {
      name: form.name,
      description: form.description,
      points_cost: form.points_cost,
      stock: form.track_stock ? (form.stock === '' ? 0 : form.stock) : null,
      is_active: form.is_active,
    };
    if (form.image !== undefined) payload.image = form.image; // data URL nueva o null para quitarla

    setSaving(true);
    try {
      if (editing) await api.put(`/bible-club/store/items/${editing.id}`, payload, { params });
      else await api.post('/bible-club/store/items', payload, { params });
      toast.success(editing ? 'Artículo actualizado' : 'Artículo agregado');
      setItemDialog(null);
      load();
      if (onChanged) onChanged();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar el artículo');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`¿Eliminar "${item.name}" de la tiendita? Los canjes ya registrados se conservan.`)) return;
    try {
      await api.delete(`/bible-club/store/items/${item.id}`, { params });
      toast.success('Artículo eliminado');
      load();
      if (onChanged) onChanged();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al eliminar');
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullScreen={isMobile} maxWidth="md" fullWidth>
        <AppBar position="sticky" elevation={0} color="inherit" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={onClose} aria-label="Cerrar"><CloseIcon /></IconButton>
            <StorefrontIcon color="warning" />
            <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }} noWrap>Tiendita</Typography>
            {canCreate && (
              <Button variant="contained" color="warning" size="small" startIcon={<AddIcon />} onClick={openNewItem}>
                Artículo
              </Button>
            )}
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ p: { xs: 1.5, sm: 3 } }}>
          {loading || !settings ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
          ) : (
            <>
              {/* ===== ENLACE PARA COMPARTIR ===== */}
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#FFF8E1', borderColor: 'warning.light' }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Enlace para los muchachos
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Cualquiera con el enlace ve los premios{settings.show_standings ? ' y la tabla de posiciones (con nombres abreviados)' : ''}, sin iniciar sesión.
                </Typography>
                {!store?.is_public && (
                  <Alert severity="warning" sx={{ mb: 1.5 }}>La tiendita está cerrada: el enlace muestra "cerrada por ahora".</Alert>
                )}
                <TextField fullWidth size="small" value={publicUrl} InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={copyLink} aria-label="Copiar enlace"><ContentCopyIcon fontSize="small" /></IconButton>
                    </InputAdornment>
                  ),
                }} />
                <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
                  <Button size="small" variant="contained" color="success" startIcon={<WhatsAppIcon />}
                    href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<OpenInNewIcon />}
                    href={publicPath} target="_blank" rel="noopener noreferrer">
                    Ver página
                  </Button>
                  {canEdit && (
                    <Button size="small" color="inherit" startIcon={<RefreshIcon />} onClick={regenerate}>
                      Enlace nuevo
                    </Button>
                  )}
                </Stack>
              </Paper>

              {/* ===== AJUSTES ===== */}
              {canEdit && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Título de la página" value={settings.title}
                        onChange={(e) => setSettings({ ...settings, title: e.target.value })} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Aviso (opcional)" placeholder="Ej: Los canjes son el último sábado del mes"
                        value={settings.message} onChange={(e) => setSettings({ ...settings, message: e.target.value })} />
                    </Grid>
                    <Grid item xs={12} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                      <FormControlLabel label="Tiendita abierta"
                        control={<Switch checked={settings.is_public} onChange={(e) => setSettings({ ...settings, is_public: e.target.checked })} />} />
                      <FormControlLabel label="Mostrar tabla de posiciones"
                        control={<Switch checked={settings.show_standings} onChange={(e) => setSettings({ ...settings, show_standings: e.target.checked })} />} />
                      <Box sx={{ flex: 1 }} />
                      <Button size="small" variant="outlined" onClick={() => saveSettings()}>Guardar ajustes</Button>
                    </Grid>
                  </Grid>
                </Paper>
              )}

              <Divider sx={{ mb: 2 }}><Chip size="small" label={`${items.length} artículo(s)`} /></Divider>

              {/* ===== CATÁLOGO ===== */}
              {items.length === 0 ? (
                <Alert severity="info">
                  Aún no hay artículos. Agrega el primero con su foto y lo que cuesta en puntos.
                </Alert>
              ) : (
                <Grid container spacing={1.5}>
                  {items.map((item) => (
                    <Grid item xs={6} sm={4} md={3} key={item.id}>
                      <Paper variant="outlined" sx={{ overflow: 'hidden', opacity: item.is_active ? 1 : 0.55, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <ItemPhoto src={item.image_url} alt={item.name} soldOut={!item.available} />
                        <Box sx={{ p: 1.25, flex: 1 }}>
                          <Typography variant="body2" fontWeight={700} noWrap title={item.name}>{item.name}</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                            <Chip size="small" color="warning" label={`${item.points_cost} pts`} sx={{ fontWeight: 700 }} />
                            {item.stock !== null && item.available && <Chip size="small" variant="outlined" label={`Quedan ${item.stock}`} />}
                            {!item.is_active && <Chip size="small" label="Oculto" />}
                          </Box>
                        </Box>
                        {(canEdit || canDelete) && (
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 0.5, pb: 0.5 }}>
                            {canEdit && <IconButton size="small" onClick={() => openEditItem(item)} aria-label="Editar"><EditIcon fontSize="small" /></IconButton>}
                            {canDelete && <IconButton size="small" color="error" onClick={() => deleteItem(item)} aria-label="Eliminar"><DeleteIcon fontSize="small" /></IconButton>}
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== DIÁLOGO: ARTÍCULO ===== */}
      <Dialog open={!!itemDialog} onClose={() => !saving && setItemDialog(null)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        {itemDialog && (
          <form onSubmit={saveItem}>
            <DialogTitle>{itemDialog.editing ? 'Editar artículo' : 'Nuevo artículo'}</DialogTitle>
            <DialogContent dividers>
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
              <Box onClick={() => fileInput.current?.click()} sx={{
                height: 200, mb: 2, borderRadius: 2, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                border: '2px dashed', borderColor: 'divider', bgcolor: 'grey.50',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {compressing ? <CircularProgress /> : itemDialog.form.preview ? (
                  <Box component="img" src={itemDialog.form.preview} alt="Foto" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                    <PhotoCameraIcon sx={{ fontSize: 40 }} />
                    <Typography variant="body2">Toca para agregar una foto</Typography>
                  </Box>
                )}
              </Box>
              {itemDialog.form.preview && (
                <Stack direction="row" spacing={1} sx={{ mb: 2, mt: -1 }}>
                  <Button size="small" startIcon={<PhotoCameraIcon />} onClick={() => fileInput.current?.click()}>Cambiar foto</Button>
                  <Button size="small" color="error" startIcon={<NoImageIcon />} onClick={() => setForm({ image: null, preview: null })}>Quitar</Button>
                </Stack>
              )}
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth required size="small" label="Nombre" placeholder="Ej: Audífonos"
                    value={itemDialog.form.name} onChange={(e) => setForm({ name: e.target.value })}
                    inputProps={{ maxLength: 120 }} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Descripción (opcional)" multiline rows={2}
                    value={itemDialog.form.description} onChange={(e) => setForm({ description: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth required size="small" type="number" label="Costo en puntos"
                    inputProps={{ min: 1, inputMode: 'numeric' }}
                    value={itemDialog.form.points_cost} onChange={(e) => setForm({ points_cost: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" type="number" label="Cantidad"
                    disabled={!itemDialog.form.track_stock}
                    placeholder={itemDialog.form.track_stock ? '0' : 'Sin límite'}
                    inputProps={{ min: 0, inputMode: 'numeric' }}
                    value={itemDialog.form.stock} onChange={(e) => setForm({ stock: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel label="Llevar inventario (baja al canjear)"
                    control={<Switch checked={itemDialog.form.track_stock} onChange={(e) => setForm({ track_stock: e.target.checked })} />} />
                  <FormControlLabel label="Visible en la tiendita"
                    control={<Switch checked={itemDialog.form.is_active} onChange={(e) => setForm({ is_active: e.target.checked })} />} />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setItemDialog(null)} disabled={saving}>Cancelar</Button>
              <Button type="submit" variant="contained" color="warning" disabled={saving || compressing}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>
    </>
  );
};

export default StoreDialog;

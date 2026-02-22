/**
 * Branding.js - Gestión de branding (logo + título) por iglesia
 * 
 * FUNCIONALIDAD:
 * - Admin: ve y edita SOLO el branding de su iglesia
 * - SuperAdmin: ve y edita el branding de CUALQUIER iglesia
 * - Subir logo PNG/JPG (máx 5MB)
 * - Editar título personalizado de login
 * - Preview en tiempo real de cómo se verá el login
 * 
 * ENDPOINTS USADOS:
 *   GET    /api/branding             → Lista branding de iglesias
 *   PUT    /api/branding/:churchId   → Actualizar título
 *   POST   /api/branding/:churchId/logo → Subir logo
 *   DELETE  /api/branding/:churchId/logo → Eliminar logo
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, CircularProgress, Avatar, Chip,
  Card, CardContent, Divider, Alert,
} from '@mui/material';
import {
  Edit as EditIcon, Delete as DeleteIcon, CloudUpload as UploadIcon,
  Palette as PaletteIcon, Church as ChurchIcon, Image as ImageIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';

/** URL base para archivos estáticos (uploads) */
const getFileUrl = (path) => {
  if (!path) return null;
  // En desarrollo el backend corre en :5000, en producción mismo origen
  const base = process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace('/api', '')
    : '';
  return `${base}${path}`;
};

const Branding = () => {
  const { user, isSuperAdmin } = useAuth();
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal de edición
  const [showModal, setShowModal] = useState(false);
  const [editingChurch, setEditingChurch] = useState(null);
  const [loginTitle, setLoginTitle] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal de subir logo
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadChurch, setUploadChurch] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Modal de preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // ===== CARGAR LISTA DE IGLESIAS CON BRANDING =====
  const loadChurches = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/branding');
      setChurches(data.churches || []);
    } catch (error) {
      toast.error('Error al cargar branding');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadChurches(); }, [loadChurches]);

  // ===== EDITAR TÍTULO DE LOGIN =====
  const openEditTitle = (church) => {
    setEditingChurch(church);
    setLoginTitle(church.login_title || church.name);
    setShowModal(true);
  };

  const handleSaveTitle = async () => {
    setSaving(true);
    try {
      await api.put(`/branding/${editingChurch.id}`, { login_title: loginTitle });
      toast.success('Título actualizado');
      setShowModal(false);
      loadChurches();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // ===== SUBIR LOGO =====
  const openUploadLogo = (church) => {
    setUploadChurch(church);
    setSelectedFile(null);
    setFilePreview(null);
    setShowUploadModal(true);
  };

  /** Manejar selección de archivo y generar preview */
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo
    if (!/\.(png|jpg|jpeg|gif|webp)$/i.test(file.name)) {
      toast.error('Solo se permiten imágenes (PNG, JPG, GIF, WEBP)');
      return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo no debe superar 5 MB');
      return;
    }

    setSelectedFile(file);

    // Generar preview con FileReader
    const reader = new FileReader();
    reader.onload = (evt) => setFilePreview(evt.target.result);
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async () => {
    if (!selectedFile) {
      toast.error('Seleccione un archivo');
      return;
    }

    setUploading(true);
    try {
      // Enviar como multipart/form-data
      const formData = new FormData();
      formData.append('logo', selectedFile);

      await api.post(`/branding/${uploadChurch.id}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Logo subido exitosamente');
      setShowUploadModal(false);
      loadChurches();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al subir logo');
    } finally {
      setUploading(false);
    }
  };

  // ===== ELIMINAR LOGO =====
  const handleDeleteLogo = async (church) => {
    if (!window.confirm(`¿Eliminar el logo de "${church.name}"?`)) return;
    try {
      await api.delete(`/branding/${church.id}/logo`);
      toast.success('Logo eliminado');
      loadChurches();
    } catch (error) {
      toast.error('Error al eliminar logo');
    }
  };

  // ===== PREVIEW DE LOGIN =====
  const openPreview = (church) => {
    setPreviewData(church);
    setShowPreview(true);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaletteIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Branding de Login</Typography>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Personalice el logo y título que aparecen en la pantalla de inicio de sesión de su iglesia.
        {isSuperAdmin() && ' Como SuperAdmin, puede editar el branding de cualquier iglesia.'}
      </Alert>

      {/* Tabla de iglesias */}
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Logo</TableCell>
                <TableCell>Iglesia</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Título Login</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell>
                </TableRow>
              ) : churches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>No hay iglesias registradas</TableCell>
                </TableRow>
              ) : churches.map((ch) => (
                <TableRow key={ch.id} hover>
                  {/* Logo thumbnail */}
                  <TableCell sx={{ width: 60 }}>
                    {ch.login_logo_url ? (
                      <Avatar
                        src={getFileUrl(ch.login_logo_url)}
                        variant="rounded"
                        sx={{ width: 48, height: 48 }}
                      >
                        <ChurchIcon />
                      </Avatar>
                    ) : (
                      <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: 'grey.200' }}>
                        <ImageIcon color="disabled" />
                      </Avatar>
                    )}
                  </TableCell>

                  {/* Nombre de la iglesia */}
                  <TableCell>
                    <Typography fontWeight={600} fontSize={14}>{ch.name}</Typography>
                  </TableCell>

                  {/* Título personalizado */}
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {ch.login_title ? (
                      <Chip label={ch.login_title} size="small" variant="outlined" />
                    ) : (
                      <Typography variant="caption" color="text.secondary">Usa nombre de iglesia</Typography>
                    )}
                  </TableCell>

                  {/* Acciones */}
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openPreview(ch)} color="info" title="Preview">
                      <PreviewIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => openEditTitle(ch)} color="primary" title="Editar título">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => openUploadLogo(ch)} color="success" title="Subir logo">
                      <UploadIcon fontSize="small" />
                    </IconButton>
                    {ch.login_logo_url && (
                      <IconButton size="small" onClick={() => handleDeleteLogo(ch)} color="error" title="Eliminar logo">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ===== DIALOG: EDITAR TÍTULO ===== */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Título de Login</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Este título aparecerá en la pantalla de inicio de sesión en lugar del nombre de la iglesia.
            Déjelo vacío para usar el nombre de la iglesia.
          </Typography>
          <TextField
            fullWidth size="small"
            label="Título personalizado"
            value={loginTitle}
            onChange={(e) => setLoginTitle(e.target.value)}
            placeholder={editingChurch?.name || 'Nombre de la iglesia'}
            helperText="Máximo 200 caracteres"
            inputProps={{ maxLength: 200 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setShowModal(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveTitle} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== DIALOG: SUBIR LOGO ===== */}
      <Dialog open={showUploadModal} onClose={() => setShowUploadModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Subir Logo — {uploadChurch?.name}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Seleccione una imagen PNG, JPG, GIF o WEBP (máx 5 MB).
            Se recomienda un logo cuadrado de al menos 200×200 px.
          </Typography>

          {/* Botón de selección de archivo */}
          <Button variant="outlined" component="label" fullWidth startIcon={<UploadIcon />} sx={{ mb: 2 }}>
            {selectedFile ? selectedFile.name : 'Seleccionar imagen...'}
            <input type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFileSelect} />
          </Button>

          {/* Preview del archivo seleccionado */}
          {filePreview && (
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <img
                src={filePreview}
                alt="Preview"
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid #ddd' }}
              />
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                {selectedFile?.name} — {(selectedFile?.size / 1024).toFixed(1)} KB
              </Typography>
            </Box>
          )}

          {/* Logo actual */}
          {uploadChurch?.login_logo_url && !filePreview && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>Logo actual:</Typography>
              <Box sx={{ mt: 1 }}>
                <img
                  src={getFileUrl(uploadChurch.login_logo_url)}
                  alt="Logo actual"
                  style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 8, border: '1px solid #ddd' }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setShowUploadModal(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleUploadLogo}
            disabled={uploading || !selectedFile}
            startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <UploadIcon />}>
            {uploading ? 'Subiendo...' : 'Subir Logo'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== DIALOG: PREVIEW DE LOGIN ===== */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Preview de Login</DialogTitle>
        <DialogContent>
          {previewData && (
            <Card elevation={4} sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{
                background: 'linear-gradient(135deg, #0D47A1 0%, #1a237e 100%)',
                p: 3, textAlign: 'center',
              }}>
                {/* Logo o icono por defecto */}
                {previewData.login_logo_url ? (
                  <Box sx={{ mb: 1 }}>
                    <img
                      src={getFileUrl(previewData.login_logo_url)}
                      alt="Logo"
                      style={{ maxWidth: 80, maxHeight: 80, borderRadius: 8 }}
                    />
                  </Box>
                ) : (
                  <ChurchIcon sx={{ fontSize: 48, color: '#fff', mb: 1 }} />
                )}

                {/* Título personalizado o nombre */}
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                  {previewData.login_title || previewData.name}
                </Typography>
              </Box>

              <CardContent sx={{ p: 3 }}>
                {/* Campos simulados */}
                <TextField fullWidth size="small" label="Correo electrónico" disabled sx={{ mb: 2 }} />
                <TextField fullWidth size="small" label="Contraseña" disabled sx={{ mb: 2 }} />
                <Button fullWidth variant="contained" disabled>Iniciar Sesión</Button>
              </CardContent>
            </Card>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Branding;

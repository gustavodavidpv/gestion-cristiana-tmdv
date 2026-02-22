/**
 * Minutes.js - Actas de reuniones con MUI + subida de archivos
 * 
 * FUNCIONALIDAD:
 * - Crear actas con asistentes, motivos/puntos de agenda
 * - Ver detalle completo de un acta
 * - Subir 1 o varios archivos adjuntos por acta (PDF, DOC, DOCX, JPG, PNG)
 * - Descargar y eliminar archivos adjuntos
 * - Los archivos se guardan en public/uploads/minutes/
 * 
 * ENDPOINTS DE ARCHIVOS:
 *   POST   /api/minutes/:id/upload         → Subir archivo(s)
 *   DELETE /api/minutes/:id/files/:fileId  → Eliminar un archivo
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
  Box, Paper, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, CircularProgress, TablePagination, Divider, List, ListItem,
  ListItemIcon, ListItemText, ListItemSecondaryAction, Alert, LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon, Visibility as ViewIcon, Delete as DeleteIcon,
  Close as CloseIcon, CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon, PictureAsPdf as PdfIcon,
  Image as ImageIcon, Description as DocIcon, Download as DownloadIcon,
  AttachFile as AttachIcon,
} from '@mui/icons-material';

/** URL base para descargar archivos estáticos (uploads) */
const getFileUrl = (path) => {
  if (!path) return '#';
  const base = process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace('/api', '')
    : '';
  return `${base}${path}`;
};

/** Retorna un icono apropiado según el tipo de archivo */
const getFileIcon = (fileType) => {
  if (!fileType) return <FileIcon />;
  if (fileType.includes('pdf')) return <PdfIcon color="error" />;
  if (fileType.includes('image')) return <ImageIcon color="primary" />;
  if (fileType.includes('word') || fileType.includes('document')) return <DocIcon color="info" />;
  return <FileIcon />;
};

/** Formatea bytes a texto legible (KB, MB) */
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Minutes = () => {
  const { hasRole } = useAuth();
  const [minutes, setMinutes] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({
    title: '', objective: '', meeting_date: '', attendee_ids: [],
    motions: [{ title: '', description: '', result: 'Pendiente' }],
  });

  // === Estado de subida de archivos ===
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ===== CARGA DE ACTAS =====
  const loadMinutes = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const { data } = await api.get('/minutes', { params: { page: page + 1, limit: 15 } });
      setMinutes(data.minutes);
      setPagination({ page, total: data.pagination.total });
    } catch (error) {
      toast.error('Error al cargar actas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMinutes(); }, [loadMinutes]);

  const loadMembers = async () => {
    try {
      const { data } = await api.get('/members', { params: { limit: 200 } });
      setMembers(data.members);
    } catch (error) {
      console.error('Error loading members');
    }
  };

  // ===== CRUD DE ACTAS =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/minutes', form);
      toast.success('Acta creada exitosamente');
      setShowModal(false);
      loadMinutes(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al crear acta');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta acta y todos sus archivos?')) return;
    try {
      await api.delete(`/minutes/${id}`);
      toast.success('Acta eliminada');
      loadMinutes(pagination.page);
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const viewDetail = async (id) => {
    try {
      const { data } = await api.get(`/minutes/${id}`);
      setShowDetail(data.minute);
    } catch (error) {
      toast.error('Error al cargar detalle');
    }
  };

  /** Recargar detalle después de subir/eliminar archivos */
  const reloadDetail = async () => {
    if (!showDetail) return;
    try {
      const { data } = await api.get(`/minutes/${showDetail.id}`);
      setShowDetail(data.minute);
    } catch (error) {
      console.error('Error recargando detalle:', error);
    }
  };

  const openNew = async () => {
    await loadMembers();
    setForm({
      title: '', objective: '', meeting_date: '', attendee_ids: [],
      motions: [{ title: '', description: '', result: 'Pendiente' }],
    });
    setShowModal(true);
  };

  // === Motivos ===
  const addMotion = () => {
    setForm({ ...form, motions: [...form.motions, { title: '', description: '', result: 'Pendiente' }] });
  };
  const updateMotion = (index, field, value) => {
    const updated = [...form.motions];
    updated[index][field] = value;
    setForm({ ...form, motions: updated });
  };
  const removeMotion = (index) => {
    setForm({ ...form, motions: form.motions.filter((_, i) => i !== index) });
  };

  // ===== SUBIDA DE ARCHIVOS =====

  /**
   * Maneja la subida de archivos a una acta existente.
   * Usa multer en el backend para guardar en public/uploads/minutes/
   * 
   * @param {Event} e - Evento del input file
   */
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validar cantidad máxima
    if (files.length > 5) {
      toast.error('Máximo 5 archivos por subida');
      return;
    }

    // Validar tipos permitidos
    const allowedExts = /\.(pdf|doc|docx|jpg|jpeg|png)$/i;
    for (const file of files) {
      if (!allowedExts.test(file.name)) {
        toast.error(`Archivo no permitido: ${file.name}. Solo PDF, DOC, DOCX, JPG, PNG.`);
        return;
      }
      // Validar tamaño (10MB por archivo)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Archivo muy grande: ${file.name}. Máximo 10 MB.`);
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Construir FormData con todos los archivos
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));

      await api.post(`/minutes/${showDetail.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        },
      });

      toast.success(`${files.length} archivo(s) subido(s) exitosamente`);
      await reloadDetail(); // Recargar para ver archivos nuevos
      loadMinutes(pagination.page); // Recargar tabla también
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al subir archivo(s)');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Limpiar el input file para poder subir el mismo archivo de nuevo
      e.target.value = '';
    }
  };

  /**
   * Elimina un archivo específico de una acta.
   * Elimina tanto el registro en BD como el archivo físico en disco.
   */
  const handleDeleteFile = async (fileId, fileName) => {
    if (!window.confirm(`¿Eliminar el archivo "${fileName}"?`)) return;
    try {
      await api.delete(`/minutes/${showDetail.id}/files/${fileId}`);
      toast.success('Archivo eliminado');
      await reloadDetail();
    } catch (error) {
      toast.error('Error al eliminar archivo');
    }
  };

  // ===== HELPERS =====
  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const resultColor = (r) => {
    const map = { Aprobado: 'success', Rechazado: 'error', Pendiente: 'warning' };
    return map[r] || 'default';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Actas de Reuniones</Typography>
        {hasRole('Administrador', 'Secretaría') && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Nueva Acta</Button>
        )}
      </Box>

      {/* Tabla de actas */}
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Título</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Fecha</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Objetivo</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Creado por</TableCell>
                <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Archivos</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
              ) : minutes.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>No hay actas registradas</TableCell></TableRow>
              ) : minutes.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={14}>{m.title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { sm: 'none' } }}>
                      {formatDate(m.meeting_date)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{formatDate(m.meeting_date)}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.objective || '-'}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{m.creator?.full_name || '-'}</TableCell>
                  <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {/* Mostrar cantidad de archivos adjuntos */}
                    <Chip
                      icon={<AttachIcon />}
                      label={m.files?.length || 0}
                      size="small"
                      variant="outlined"
                      color={m.files?.length > 0 ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => viewDetail(m.id)} color="primary" title="Ver detalle">
                      <ViewIcon fontSize="small" />
                    </IconButton>
                    {hasRole('Administrador') && (
                      <IconButton size="small" onClick={() => handleDelete(m.id)} color="error" title="Eliminar">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={pagination.total} page={pagination.page}
          onPageChange={(_, p) => loadMinutes(p)} rowsPerPage={15} rowsPerPageOptions={[15]}
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`} />
      </Paper>

      {/* ===== DIALOG: CREAR ACTA ===== */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>Nueva Acta</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={8}>
                <TextField fullWidth required size="small" label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth required size="small" label="Fecha" type="date" InputLabelProps={{ shrink: true }}
                  value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Objetivo" multiline rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Asistentes</InputLabel>
                  <Select multiple value={form.attendee_ids} label="Asistentes"
                    onChange={(e) => setForm({ ...form, attendee_ids: e.target.value })}
                    renderValue={(selected) => `${selected.length} seleccionados`}>
                    {members.map((m) => (
                      <MenuItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Motivos */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 3, mb: 1 }}>Motivos / Puntos de Agenda</Typography>
            {form.motions.map((motion, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">Motivo #{idx + 1}</Typography>
                  {form.motions.length > 1 && (
                    <IconButton size="small" onClick={() => removeMotion(idx)} color="error"><CloseIcon fontSize="small" /></IconButton>
                  )}
                </Box>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={7}>
                    <TextField fullWidth required size="small" label="Título" value={motion.title} onChange={(e) => updateMotion(idx, 'title', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={5}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Resultado</InputLabel>
                      <Select value={motion.result} onChange={(e) => updateMotion(idx, 'result', e.target.value)} label="Resultado">
                        <MenuItem value="Pendiente">Pendiente</MenuItem>
                        <MenuItem value="Aprobado">Aprobado</MenuItem>
                        <MenuItem value="Rechazado">Rechazado</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth size="small" label="Descripción" multiline rows={2} value={motion.description} onChange={(e) => updateMotion(idx, 'description', e.target.value)} />
                  </Grid>
                </Grid>
              </Paper>
            ))}
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addMotion}>Agregar Motivo</Button>

            <Alert severity="info" sx={{ mt: 2 }}>
              Podrá subir archivos adjuntos después de crear el acta, desde la vista de detalle.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="contained" type="submit">Crear Acta</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ===== DIALOG: DETALLE DE ACTA + ARCHIVOS ===== */}
      <Dialog open={!!showDetail} onClose={() => setShowDetail(null)} maxWidth="md" fullWidth>
        {showDetail && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6">{showDetail.title}</Typography>
                <IconButton onClick={() => setShowDetail(null)}><CloseIcon /></IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              {/* Info básica */}
              <Grid container spacing={1} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2"><strong>Fecha:</strong> {formatDate(showDetail.meeting_date)}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2"><strong>Creado por:</strong> {showDetail.creator?.full_name || '-'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2"><strong>Objetivo:</strong> {showDetail.objective || '-'}</Typography>
                </Grid>
              </Grid>

              {/* Asistentes */}
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Asistentes ({showDetail.attendees?.length || 0})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                {showDetail.attendees?.map((a) => (
                  <Chip key={a.id} label={`${a.member?.first_name} ${a.member?.last_name}`} size="small" variant="outlined" />
                ))}
                {!showDetail.attendees?.length && <Typography variant="body2" color="text.secondary">Sin asistentes</Typography>}
              </Box>

              {/* Motivos */}
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Motivos ({showDetail.motions?.length || 0})
              </Typography>
              {showDetail.motions?.map((motion, idx) => (
                <Paper key={motion.id} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography fontWeight={600}>#{idx + 1} - {motion.title}</Typography>
                    <Chip label={motion.result} size="small" color={resultColor(motion.result)} />
                  </Box>
                  <Typography variant="body2" color="text.secondary">{motion.description || 'Sin descripción'}</Typography>
                  {motion.voters?.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" fontWeight={600}>Votantes:</Typography>
                      {motion.voters.map((v) => (
                        <Typography key={v.id} variant="caption" display="block" color="text.secondary">
                          • {v.member?.first_name} {v.member?.last_name} — {v.vote_type}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Paper>
              ))}

              <Divider sx={{ my: 2 }} />

              {/* ===== SECCIÓN DE ARCHIVOS ADJUNTOS ===== */}
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                <AttachIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                Archivos Adjuntos ({showDetail.files?.length || 0})
              </Typography>

              {/* Lista de archivos existentes */}
              {showDetail.files?.length > 0 ? (
                <List dense sx={{ bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                  {showDetail.files.map((file) => (
                    <ListItem key={file.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {getFileIcon(file.file_type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography
                            component="a"
                            href={getFileUrl(file.file_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="body2"
                            sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                          >
                            {file.original_name}
                          </Typography>
                        }
                        secondary={formatFileSize(file.file_size)}
                      />
                      <ListItemSecondaryAction>
                        {/* Botón descargar */}
                        <IconButton size="small" component="a" href={getFileUrl(file.file_url)}
                          target="_blank" rel="noopener noreferrer" color="primary" title="Descargar">
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                        {/* Botón eliminar */}
                        {hasRole('Administrador', 'Secretaría') && (
                          <IconButton size="small" color="error" title="Eliminar archivo"
                            onClick={() => handleDeleteFile(file.id, file.original_name)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>No hay archivos adjuntos en esta acta.</Alert>
              )}

              {/* Botón de subir archivos (solo para roles autorizados) */}
              {hasRole('Administrador', 'Secretaría') && (
                <Box>
                  {/* Barra de progreso durante subida */}
                  {uploading && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Subiendo archivos... {uploadProgress}%
                      </Typography>
                      <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 0.5 }} />
                    </Box>
                  )}

                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={uploading ? <CircularProgress size={18} /> : <UploadIcon />}
                    disabled={uploading}
                    color="success"
                  >
                    {uploading ? 'Subiendo...' : 'Subir Archivos'}
                    <input
                      type="file"
                      hidden
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                    />
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    PDF, DOC, DOCX, JPG, PNG — Máx 10 MB por archivo, hasta 5 archivos
                  </Typography>
                </Box>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default Minutes;

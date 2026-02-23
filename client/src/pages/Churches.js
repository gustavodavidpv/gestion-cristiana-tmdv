/**
 * Churches.js - Gestión de iglesias con MUI
 * 
 * DOS MODOS:
 * 
 * 1. SUPERADMIN: CRUD completo de iglesias
 *    - Tabla con todas las iglesias
 *    - Crear nueva iglesia (botón + dialog)
 *    - Editar cualquier iglesia (dialog)
 *    - Eliminar iglesia (confirmación)
 *    - Click en "Configurar" abre la vista detallada (misiones, campos blancos)
 * 
 * 2. ADMIN/OTROS: Vista de configuración de su iglesia
 *    - Datos generales editables
 *    - Estadísticas automáticas (solo lectura)
 *    - CRUD de misiones y campos blancos
 * 
 * CAMPOS DE SOLO LECTURA (calculados automáticamente desde otras tablas):
 * - membership_count → desde Members (count total)
 * - Decisiones de Fe → desde EventAttendees
 * - Promedio Asistencia Semanal → desde WeeklyAttendance
 * - Predicadores/Diáconos → desde Members.church_role
 * 
 * MISIONES y CAMPOS BLANCOS:
 * - Nombre, descripción, estado activo
 * - Campos de responsable: responsible_name y responsible_phone (texto libre)
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
  Box, Paper, Typography, TextField, Button, Grid, Divider,
  CircularProgress, List, ListItem, ListItemText, IconButton,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip,
} from '@mui/material';
import {
  Save as SaveIcon, Add as AddIcon, Delete as DeleteIcon,
  Lock as LockIcon, Edit as EditIcon, Phone as PhoneIcon,
  Person as PersonIcon, Church as ChurchIcon, Settings as SettingsIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

const Churches = () => {
  const { user, hasRole, isSuperAdmin } = useAuth();

  // ===== ESTADO COMPARTIDO =====
  const [loading, setLoading] = useState(true);

  // ===== ESTADO PARA MODO SUPERADMIN (CRUD de iglesias) =====
  const [churches, setChurches] = useState([]);
  const [showChurchModal, setShowChurchModal] = useState(false);
  const [editingChurch, setEditingChurch] = useState(null);
  const [churchForm, setChurchForm] = useState({
    name: '', address: '', phone: '', responsible: '',
  });

  // ===== ESTADO PARA VISTA DETALLADA (configuración de una iglesia) =====
  /**
   * selectedChurch: cuando SuperAdmin clickea "Configurar" en una iglesia,
   * se carga aquí y se muestra la vista detallada (igual que para Admin).
   * Para Admin, se carga automáticamente su iglesia.
   */
  const [selectedChurch, setSelectedChurch] = useState(null);
  const [form, setForm] = useState({});

  // === Estado de Misiones ===
  const [missionModal, setMissionModal] = useState(false);
  const [editingMission, setEditingMission] = useState(null);
  const [missionForm, setMissionForm] = useState({
    name: '', responsible_name: '', responsible_phone: '',
  });

  // === Estado de Campos Blancos ===
  const [wfModal, setWfModal] = useState(false);
  const [editingWf, setEditingWf] = useState(null);
  const [wfForm, setWfForm] = useState({
    name: '', responsible_name: '', responsible_phone: '',
  });

  // =========================================================
  // CARGA DE DATOS
  // =========================================================

  /**
   * SuperAdmin: carga TODAS las iglesias para la tabla CRUD.
   * Admin: carga solo su iglesia y entra directo a la vista detallada.
   */
  const loadChurches = useCallback(async () => {
    setLoading(true);
    try {
      if (isSuperAdmin()) {
        // SuperAdmin: cargar lista completa
        const { data } = await api.get('/churches');
        setChurches(data.churches || []);
      } else {
        // Admin: cargar directo su iglesia en vista detallada
        if (user?.church_id) {
          const { data } = await api.get(`/churches/${user.church_id}`);
          setSelectedChurch(data.church);
          setForm(data.church);
        }
      }
    } catch (error) {
      toast.error('Error al cargar datos de iglesias');
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin]);

  useEffect(() => { loadChurches(); }, [loadChurches]);

  /**
   * Carga el detalle completo de una iglesia (con misiones y campos blancos).
   * Usada por SuperAdmin al clickear "Configurar" y para recargar después de cambios.
   */
  const loadChurchDetail = async (churchId) => {
    try {
      const { data } = await api.get(`/churches/${churchId}`);
      setSelectedChurch(data.church);
      setForm(data.church);
    } catch (error) {
      toast.error('Error al cargar detalle de la iglesia');
    }
  };

  // =========================================================
  // CRUD DE IGLESIAS (solo SuperAdmin)
  // =========================================================

  /** Abrir modal para crear nueva iglesia */
  const openNewChurch = () => {
    setEditingChurch(null);
    setChurchForm({ name: '', address: '', phone: '', responsible: '' });
    setShowChurchModal(true);
  };

  /** Abrir modal para editar iglesia existente */
  const openEditChurch = (church) => {
    setEditingChurch(church);
    setChurchForm({
      name: church.name || '',
      address: church.address || '',
      phone: church.phone || '',
      responsible: church.responsible || '',
    });
    setShowChurchModal(true);
  };

  /** Guardar iglesia (crear o editar) */
  const saveChurch = async () => {
    if (!churchForm.name.trim()) {
      toast.warning('El nombre de la iglesia es requerido');
      return;
    }
    try {
      if (editingChurch) {
        await api.put(`/churches/${editingChurch.id}`, churchForm);
        toast.success('Iglesia actualizada');
      } else {
        await api.post('/churches', churchForm);
        toast.success('Iglesia creada exitosamente');
      }
      setShowChurchModal(false);
      loadChurches(); // Recargar lista
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar iglesia');
    }
  };

  /** Eliminar iglesia (solo SuperAdmin) */
  const deleteChurch = async (id) => {
    if (!window.confirm('¿Eliminar esta iglesia? Se eliminarán todos sus datos asociados (miembros, eventos, actas, etc.). Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/churches/${id}`);
      toast.success('Iglesia eliminada');
      loadChurches();
    } catch (error) {
      toast.error('Error al eliminar iglesia');
    }
  };

  /** SuperAdmin: abrir vista detallada de una iglesia */
  const openChurchConfig = (church) => {
    loadChurchDetail(church.id);
  };

  /** SuperAdmin: volver a la lista de iglesias */
  const backToList = () => {
    setSelectedChurch(null);
    setForm({});
    loadChurches();
  };

  // =========================================================
  // GUARDAR DATOS GENERALES DE IGLESIA (vista detallada)
  // =========================================================
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/churches/${selectedChurch.id}`, form);
      toast.success('Iglesia actualizada exitosamente');
      loadChurchDetail(selectedChurch.id);
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  // =========================================================
  // MISIONES: CRUD con Dialog
  // =========================================================

  /** Abrir modal para nueva misión */
  const openNewMission = () => {
    setEditingMission(null);
    setMissionForm({ name: '', responsible_name: '', responsible_phone: '' });
    setMissionModal(true);
  };

  /** Abrir modal para editar misión existente */
  const openEditMission = (m) => {
    setEditingMission(m);
    setMissionForm({
      name: m.name || '',
      responsible_name: m.responsible_name || '',
      responsible_phone: m.responsible_phone || '',
    });
    setMissionModal(true);
  };

  /** Guardar misión (crear o editar) */
  const saveMission = async () => {
    if (!missionForm.name.trim()) {
      toast.warning('El nombre de la misión es requerido');
      return;
    }
    try {
      if (editingMission) {
        await api.put(`/churches/${selectedChurch.id}/missions/${editingMission.id}`, missionForm);
        toast.success('Misión actualizada');
      } else {
        await api.post(`/churches/${selectedChurch.id}/missions`, missionForm);
        toast.success('Misión agregada');
      }
      setMissionModal(false);
      loadChurchDetail(selectedChurch.id);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar misión');
    }
  };

  /** Eliminar misión */
  const deleteMission = async (missionId) => {
    if (!window.confirm('¿Eliminar esta misión?')) return;
    try {
      await api.delete(`/churches/${selectedChurch.id}/missions/${missionId}`);
      toast.success('Misión eliminada');
      loadChurchDetail(selectedChurch.id);
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  // =========================================================
  // CAMPOS BLANCOS: CRUD con Dialog
  // =========================================================

  /** Abrir modal para nuevo campo blanco */
  const openNewWf = () => {
    setEditingWf(null);
    setWfForm({ name: '', responsible_name: '', responsible_phone: '' });
    setWfModal(true);
  };

  /** Abrir modal para editar campo blanco existente */
  const openEditWf = (wf) => {
    setEditingWf(wf);
    setWfForm({
      name: wf.name || '',
      responsible_name: wf.responsible_name || '',
      responsible_phone: wf.responsible_phone || '',
    });
    setWfModal(true);
  };

  /** Guardar campo blanco (crear o editar) */
  const saveWf = async () => {
    if (!wfForm.name.trim()) {
      toast.warning('El nombre del campo blanco es requerido');
      return;
    }
    try {
      if (editingWf) {
        await api.put(`/churches/${selectedChurch.id}/white-fields/${editingWf.id}`, wfForm);
        toast.success('Campo blanco actualizado');
      } else {
        await api.post(`/churches/${selectedChurch.id}/white-fields`, wfForm);
        toast.success('Campo blanco agregado');
      }
      setWfModal(false);
      loadChurchDetail(selectedChurch.id);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  /** Eliminar campo blanco */
  const deleteWhiteField = async (fieldId) => {
    if (!window.confirm('¿Eliminar este campo blanco?')) return;
    try {
      await api.delete(`/churches/${selectedChurch.id}/white-fields/${fieldId}`);
      toast.success('Campo blanco eliminado');
      loadChurchDetail(selectedChurch.id);
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  // =========================================================
  // RENDERS
  // =========================================================

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  // =============================================================
  // MODO SUPERADMIN: TABLA CRUD DE IGLESIAS
  // (se muestra cuando SuperAdmin Y no hay iglesia seleccionada)
  // =============================================================
  if (isSuperAdmin() && !selectedChurch) {
    return (
      <Box>
        {/* Header con botón crear */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h5" fontWeight={700}>Iglesias</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNewChurch}>
            Nueva Iglesia
          </Button>
        </Box>

        {/* Tabla de iglesias */}
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Responsable</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Dirección</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Teléfono</TableCell>
                  <TableCell align="center">Miembros</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {churches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      No hay iglesias registradas
                    </TableCell>
                  </TableRow>
                ) : churches.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Typography fontWeight={600} fontSize={14}>{c.name}</Typography>
                      {/* En móvil mostrar responsable debajo del nombre */}
                      {c.responsible && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: { sm: 'none' } }}>
                          {c.responsible}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      {c.responsible || '-'}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      {c.address || '-'}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      {c.phone || '-'}
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={c.membership_count || 0} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      {/* Botón para abrir la configuración detallada */}
                      <IconButton size="small" onClick={() => openChurchConfig(c)}
                        color="info" title="Configurar">
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => openEditChurch(c)}
                        color="primary" title="Editar">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteChurch(c.id)}
                        color="error" title="Eliminar">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* ===== DIALOG: CREAR/EDITAR IGLESIA ===== */}
        <Dialog open={showChurchModal} onClose={() => setShowChurchModal(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ChurchIcon color="primary" />
              {editingChurch ? 'Editar Iglesia' : 'Nueva Iglesia'}
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField fullWidth required size="small" label="Nombre de la Iglesia"
                  value={churchForm.name}
                  onChange={(e) => setChurchForm({ ...churchForm, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Responsable de la Obra"
                  value={churchForm.responsible}
                  onChange={(e) => setChurchForm({ ...churchForm, responsible: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Dirección"
                  value={churchForm.address}
                  onChange={(e) => setChurchForm({ ...churchForm, address: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Teléfono"
                  value={churchForm.phone}
                  onChange={(e) => setChurchForm({ ...churchForm, phone: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setShowChurchModal(false)}>Cancelar</Button>
            <Button variant="contained" onClick={saveChurch}>
              {editingChurch ? 'Actualizar' : 'Crear Iglesia'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // =============================================================
  // VISTA DETALLADA DE UNA IGLESIA
  // (Admin ve su iglesia, SuperAdmin ve la que seleccionó)
  // =============================================================

  if (!selectedChurch) return <Alert severity="info">No hay iglesia asignada a tu cuenta.</Alert>;

  return (
    <Box>
      {/* Botón volver (solo SuperAdmin, para regresar a la tabla de iglesias) */}
      {isSuperAdmin() && (
        <Button startIcon={<ArrowBackIcon />} onClick={backToList} sx={{ mb: 2 }}>
          Volver a lista de iglesias
        </Button>
      )}

      <Typography variant="h5" fontWeight={700} gutterBottom>
        {isSuperAdmin() ? `Configuración: ${selectedChurch.name}` : 'Configuración de Iglesia'}
      </Typography>

      <form onSubmit={handleSave}>
        {/* Datos Generales */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Datos Generales</Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Nombre" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Responsable de la Obra" value={form.responsible || ''} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Dirección" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Teléfono" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Grid>
          </Grid>
        </Paper>

        {/* ===== ESTADÍSTICAS AUTOMÁTICAS (SOLO LECTURA) ===== */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LockIcon fontSize="small" color="action" />
            <Typography variant="h6">Estadísticas Automáticas</Typography>
          </Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Estos valores se calculan automáticamente y no se pueden editar directamente.
          </Alert>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {/* Membresía Total → desde Members (count) */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Membresía Total</Typography>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {selectedChurch.membership_count || 0}
                </Typography>
                <Typography variant="caption" color="text.disabled">desde Miembros</Typography>
              </Paper>
            </Grid>

            {/* Asistencia Promedio Semanal → desde WeeklyAttendance */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Asistencia Promedio Semanal</Typography>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {selectedChurch.avg_weekly_attendance || 0}
                </Typography>
                <Typography variant="caption" color="text.disabled">desde Asistencia Semanal</Typography>
              </Paper>
            </Grid>

            {/* Decisiones de Fe → desde EventAttendees */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Decisiones de Fe ({selectedChurch.faith_decisions_ref_year || new Date().getFullYear()})
                </Typography>
                <Typography variant="h5" fontWeight={700} color="error.main">
                  {selectedChurch.faith_decisions_year || 0}
                </Typography>
                <Typography variant="caption" color="text.disabled">desde Eventos</Typography>
              </Paper>
            </Grid>

            {/* Predicadores Ordenados */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Predicadores Ordenados</Typography>
                <Typography variant="h5" fontWeight={700}>{selectedChurch.ordained_preachers || 0}</Typography>
                <Typography variant="caption" color="text.disabled">desde Miembros</Typography>
              </Paper>
            </Grid>

            {/* Predicadores No Ordenados */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Predicadores No Ordenados</Typography>
                <Typography variant="h5" fontWeight={700}>{selectedChurch.unordained_preachers || 0}</Typography>
                <Typography variant="caption" color="text.disabled">desde Miembros</Typography>
              </Paper>
            </Grid>

            {/* Diáconos Ordenados */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Diáconos Ordenados</Typography>
                <Typography variant="h5" fontWeight={700}>{selectedChurch.ordained_deacons || 0}</Typography>
                <Typography variant="caption" color="text.disabled">desde Miembros</Typography>
              </Paper>
            </Grid>

            {/* Diáconos No Ordenados */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Diáconos No Ordenados</Typography>
                <Typography variant="h5" fontWeight={700}>{selectedChurch.unordained_deacons || 0}</Typography>
                <Typography variant="caption" color="text.disabled">desde Miembros</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Paper>

        <Button variant="contained" startIcon={<SaveIcon />} type="submit" sx={{ mb: 3 }}>
          Guardar Cambios
        </Button>
      </form>

      {/* ===== MISIONES ===== */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">Misiones</Typography>
          {hasRole('Administrador', 'Secretaría') && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openNewMission}>
              Agregar
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />
        <List dense>
          {selectedChurch.missions?.length ? selectedChurch.missions.map((m) => (
            <ListItem key={m.id}
              secondaryAction={
                <Box>
                  {hasRole('Administrador', 'Secretaría') && (
                    <IconButton edge="end" size="small" onClick={() => openEditMission(m)} color="primary" title="Editar">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                  {hasRole('Administrador') && (
                    <IconButton edge="end" size="small" onClick={() => deleteMission(m.id)} color="error" title="Eliminar" sx={{ ml: 0.5 }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              }
            >
              <ListItemText
                primary={m.name}
                secondary={
                  <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                    {m.responsible_name && (
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography component="span" variant="caption">{m.responsible_name}</Typography>
                      </Box>
                    )}
                    {m.responsible_phone && (
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography component="span" variant="caption">{m.responsible_phone}</Typography>
                      </Box>
                    )}
                    {!m.responsible_name && !m.responsible_phone && (
                      <Typography component="span" variant="caption" color="text.disabled">Sin responsable asignado</Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          )) : <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No hay misiones registradas</Typography>}
        </List>
      </Paper>

      {/* ===== CAMPOS BLANCOS ===== */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">Campos Blancos</Typography>
          {hasRole('Administrador', 'Secretaría') && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openNewWf}>
              Agregar
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />
        <List dense>
          {selectedChurch.white_fields?.length ? selectedChurch.white_fields.map((wf) => (
            <ListItem key={wf.id}
              secondaryAction={
                <Box>
                  {hasRole('Administrador', 'Secretaría') && (
                    <IconButton edge="end" size="small" onClick={() => openEditWf(wf)} color="primary" title="Editar">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                  {hasRole('Administrador') && (
                    <IconButton edge="end" size="small" onClick={() => deleteWhiteField(wf.id)} color="error" title="Eliminar" sx={{ ml: 0.5 }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              }
            >
              <ListItemText
                primary={wf.name}
                secondary={
                  <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                    {wf.responsible_name && (
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography component="span" variant="caption">{wf.responsible_name}</Typography>
                      </Box>
                    )}
                    {wf.responsible_phone && (
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography component="span" variant="caption">{wf.responsible_phone}</Typography>
                      </Box>
                    )}
                    {!wf.responsible_name && !wf.responsible_phone && (
                      <Typography component="span" variant="caption" color="text.disabled">Sin responsable asignado</Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          )) : <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No hay campos blancos registrados</Typography>}
        </List>
      </Paper>

      {/* ===== DIALOG: MISIÓN (Crear/Editar) ===== */}
      <Dialog open={missionModal} onClose={() => setMissionModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingMission ? 'Editar Misión' : 'Nueva Misión'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth required size="small" label="Nombre de la Misión"
                value={missionForm.name}
                onChange={(e) => setMissionForm({ ...missionForm, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Nombre del Responsable"
                placeholder="Nombre y Apellido"
                value={missionForm.responsible_name}
                onChange={(e) => setMissionForm({ ...missionForm, responsible_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Celular del Responsable"
                placeholder="Ej: +507 6000-0000"
                value={missionForm.responsible_phone}
                onChange={(e) => setMissionForm({ ...missionForm, responsible_phone: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setMissionModal(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveMission}>
            {editingMission ? 'Actualizar' : 'Agregar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== DIALOG: CAMPO BLANCO (Crear/Editar) ===== */}
      <Dialog open={wfModal} onClose={() => setWfModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingWf ? 'Editar Campo Blanco' : 'Nuevo Campo Blanco'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth required size="small" label="Nombre del Campo Blanco"
                value={wfForm.name}
                onChange={(e) => setWfForm({ ...wfForm, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Nombre del Responsable"
                placeholder="Nombre y Apellido"
                value={wfForm.responsible_name}
                onChange={(e) => setWfForm({ ...wfForm, responsible_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Celular del Responsable"
                placeholder="Ej: +507 6000-0000"
                value={wfForm.responsible_phone}
                onChange={(e) => setWfForm({ ...wfForm, responsible_phone: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setWfModal(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveWf}>
            {editingWf ? 'Actualizar' : 'Agregar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Churches;

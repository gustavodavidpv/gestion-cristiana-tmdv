/**
 * Churches.js - Configuración de iglesia con MUI
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
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
  Box, Paper, Typography, TextField, Button, Grid, Divider,
  CircularProgress, List, ListItem, ListItemText, IconButton,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon, Add as AddIcon, Delete as DeleteIcon,
  Lock as LockIcon, Edit as EditIcon, Phone as PhoneIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

const Churches = () => {
  const { user, hasRole } = useAuth();
  const [church, setChurch] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

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

  // ===== CARGA DE DATOS =====
  useEffect(() => { loadChurch(); }, []);

  const loadChurch = async () => {
    try {
      if (user?.church_id) {
        const { data } = await api.get(`/churches/${user.church_id}`);
        setChurch(data.church);
        setForm(data.church);
      }
    } catch (error) {
      toast.error('Error al cargar datos de la iglesia');
    } finally {
      setLoading(false);
    }
  };

  // ===== GUARDAR DATOS GENERALES =====
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/churches/${church.id}`, form);
      toast.success('Iglesia actualizada exitosamente');
      loadChurch();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  // ===== MISIONES: CRUD con Dialog =====

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
        await api.put(`/churches/${church.id}/missions/${editingMission.id}`, missionForm);
        toast.success('Misión actualizada');
      } else {
        await api.post(`/churches/${church.id}/missions`, missionForm);
        toast.success('Misión agregada');
      }
      setMissionModal(false);
      loadChurch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar misión');
    }
  };

  /** Eliminar misión */
  const deleteMission = async (missionId) => {
    if (!window.confirm('¿Eliminar esta misión?')) return;
    try {
      await api.delete(`/churches/${church.id}/missions/${missionId}`);
      toast.success('Misión eliminada');
      loadChurch();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  // ===== CAMPOS BLANCOS: CRUD con Dialog =====

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
        await api.put(`/churches/${church.id}/white-fields/${editingWf.id}`, wfForm);
        toast.success('Campo blanco actualizado');
      } else {
        await api.post(`/churches/${church.id}/white-fields`, wfForm);
        toast.success('Campo blanco agregado');
      }
      setWfModal(false);
      loadChurch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  /** Eliminar campo blanco */
  const deleteWhiteField = async (fieldId) => {
    if (!window.confirm('¿Eliminar este campo blanco?')) return;
    try {
      await api.delete(`/churches/${church.id}/white-fields/${fieldId}`);
      toast.success('Campo blanco eliminado');
      loadChurch();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  // ===== RENDERS =====

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!church) return <Alert severity="info">No hay iglesia asignada a tu cuenta.</Alert>;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Configuración de Iglesia</Typography>

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
                  {church.membership_count || 0}
                </Typography>
                <Typography variant="caption" color="text.disabled">desde Miembros</Typography>
              </Paper>
            </Grid>

            {/* Asistencia Promedio Semanal → desde WeeklyAttendance */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Asistencia Promedio Semanal</Typography>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {church.avg_weekly_attendance || 0}
                </Typography>
                <Typography variant="caption" color="text.disabled">desde Asistencia Semanal</Typography>
              </Paper>
            </Grid>

            {/* Decisiones de Fe → desde EventAttendees */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Decisiones de Fe ({church.faith_decisions_ref_year || new Date().getFullYear()})
                </Typography>
                <Typography variant="h5" fontWeight={700} color="error.main">
                  {church.faith_decisions_year || 0}
                </Typography>
                <Typography variant="caption" color="text.disabled">desde Eventos</Typography>
              </Paper>
            </Grid>

            {/* Predicadores Ordenados */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Predicadores Ordenados</Typography>
                <Typography variant="h5" fontWeight={700}>{church.ordained_preachers || 0}</Typography>
                <Typography variant="caption" color="text.disabled">desde Miembros</Typography>
              </Paper>
            </Grid>

            {/* Predicadores No Ordenados */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Predicadores No Ordenados</Typography>
                <Typography variant="h5" fontWeight={700}>{church.unordained_preachers || 0}</Typography>
                <Typography variant="caption" color="text.disabled">desde Miembros</Typography>
              </Paper>
            </Grid>

            {/* Diáconos Ordenados */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Diáconos Ordenados</Typography>
                <Typography variant="h5" fontWeight={700}>{church.ordained_deacons || 0}</Typography>
                <Typography variant="caption" color="text.disabled">desde Miembros</Typography>
              </Paper>
            </Grid>

            {/* Diáconos No Ordenados */}
            <Grid item xs={6} sm={4} md={3}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Diáconos No Ordenados</Typography>
                <Typography variant="h5" fontWeight={700}>{church.unordained_deacons || 0}</Typography>
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
          {church.missions?.length ? church.missions.map((m) => (
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
          {church.white_fields?.length ? church.white_fields.map((wf) => (
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

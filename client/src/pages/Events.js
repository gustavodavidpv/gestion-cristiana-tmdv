/**
 * Events.js - Gestión de eventos con asistencia y decisiones de fe (MUI)
 * 
 * FIXES IMPLEMENTADOS:
 * 1. Prevención de duplicados en frontend (deduplicación por member_id)
 * 2. El backend usa REPLACE strategy (borra + inserta) con transacción
 * 3. Contadores de asistencia y decisiones de fe se calculan en tiempo real
 * 4. Las decisiones de fe se propagan automáticamente a la iglesia
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
  Box, Paper, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, CircularProgress, TablePagination, InputAdornment, Divider,
  List, ListItem, ListItemText, ListItemSecondaryAction, Checkbox,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  People as PeopleIcon, Search as SearchIcon,
  CheckCircle as CheckIcon, Favorite as FavoriteIcon,
  Close as CloseIcon, SelectAll as SelectAllIcon,
} from '@mui/icons-material';

const EVENT_TYPES = ['Evangelismo', 'Culto', 'Reunión', 'Jornada', 'Conferencia', 'Retiro', 'Otro'];

const Events = () => {
  const { hasRole } = useAuth();
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  // Estado del modal crear/editar evento
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', event_type: 'Evangelismo',
    start_date: '', end_date: '', location: '',
  });

  // Estado del modal de asistentes
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [attendeesList, setAttendeesList] = useState([]); // Lista de asistentes del evento
  const [memberSearch, setMemberSearch] = useState('');
  const [savingAttendees, setSavingAttendees] = useState(false);

  // ===== CARGA DE EVENTOS =====
  const loadEvents = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const { data } = await api.get('/events', { params: { page: page + 1, limit: 15 } });
      setEvents(data.events);
      setPagination({ page, total: data.pagination.total });
    } catch (error) {
      toast.error('Error al cargar eventos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ===== CRUD DE EVENTOS =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/events/${editing.id}`, form);
        toast.success('Evento actualizado');
      } else {
        await api.post('/events', form);
        toast.success('Evento creado');
      }
      setShowModal(false);
      loadEvents(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  const openEdit = (event) => {
    setEditing(event);
    setForm({
      title: event.title, description: event.description || '',
      event_type: event.event_type || 'Evangelismo',
      start_date: event.start_date ? event.start_date.slice(0, 16) : '',
      end_date: event.end_date ? event.end_date.slice(0, 16) : '',
      location: event.location || '',
    });
    setShowModal(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', description: '', event_type: 'Evangelismo', start_date: '', end_date: '', location: '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este evento y toda su asistencia?')) return;
    try {
      await api.delete(`/events/${id}`);
      toast.success('Evento eliminado');
      loadEvents(pagination.page);
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  // ===== GESTIÓN DE ASISTENTES =====

  /**
   * Abre el modal de asistentes cargando:
   * 1. Todos los miembros disponibles
   * 2. Los asistentes ya registrados en el evento
   */
  const openAttendees = async (event) => {
    setSelectedEvent(event);
    setMemberSearch('');
    try {
      // Cargar miembros y detalle del evento en paralelo
      const [membersRes, eventRes] = await Promise.all([
        api.get('/members', { params: { limit: 500 } }),
        api.get(`/events/${event.id}`),
      ]);

      setAllMembers(membersRes.data.members || []);

      // Mapear asistentes existentes al formato local
      const existing = (eventRes.data.event.attendees || []).map((a) => ({
        member_id: a.member_id,
        attended: a.attended,
        made_faith_decision: a.made_faith_decision,
        notes: a.notes || '',
        full_name: a.member ? `${a.member.first_name} ${a.member.last_name}` : `Miembro #${a.member_id}`,
        member_type: a.member?.member_type || '',
      }));

      setAttendeesList(existing);
      setShowAttendeesModal(true);
    } catch (error) {
      toast.error('Error al cargar datos de asistencia');
    }
  };

  /**
   * Agrega un miembro a la lista de asistentes.
   * PREVENCIÓN DE DUPLICADOS: verifica que no exista por member_id
   */
  const addMemberToAttendees = (member) => {
    if (attendeesList.some((a) => a.member_id === member.id)) {
      toast.warning('Este miembro ya está en la lista');
      return;
    }
    setAttendeesList([
      ...attendeesList,
      {
        member_id: member.id,
        attended: true,
        made_faith_decision: false,
        notes: '',
        full_name: `${member.first_name} ${member.last_name}`,
        member_type: member.member_type || '',
      },
    ]);
  };

  /** Agrega TODOS los miembros que no estén ya en la lista */
  const addAllMembers = () => {
    const newMembers = allMembers
      .filter((m) => !attendeesList.some((a) => a.member_id === m.id))
      .map((m) => ({
        member_id: m.id, attended: true, made_faith_decision: false, notes: '',
        full_name: `${m.first_name} ${m.last_name}`, member_type: m.member_type || '',
      }));
    if (newMembers.length === 0) {
      toast.info('Todos los miembros ya están en la lista');
      return;
    }
    setAttendeesList([...attendeesList, ...newMembers]);
    toast.success(`${newMembers.length} miembros agregados`);
  };

  /** Quita un miembro de la lista */
  const removeMember = (memberId) => {
    setAttendeesList(attendeesList.filter((a) => a.member_id !== memberId));
  };

  /** Toggle asistencia de un miembro */
  const toggleAttended = (memberId) => {
    setAttendeesList(attendeesList.map((a) =>
      a.member_id === memberId ? { ...a, attended: !a.attended } : a
    ));
  };

  /** Toggle decisión de fe de un miembro */
  const toggleFaithDecision = (memberId) => {
    setAttendeesList(attendeesList.map((a) =>
      a.member_id === memberId ? { ...a, made_faith_decision: !a.made_faith_decision } : a
    ));
  };

  /**
   * Guarda la asistencia en el backend.
   * El backend hace REPLACE (delete all + insert) con transacción.
   * Luego recalcula automáticamente los stats de la iglesia.
   */
  const saveAttendees = async () => {
    if (attendeesList.length === 0) {
      toast.error('Agregue al menos un asistente');
      return;
    }
    setSavingAttendees(true);
    try {
      const attendees = attendeesList.map((a) => ({
        member_id: a.member_id,
        attended: a.attended,
        made_faith_decision: a.made_faith_decision,
        notes: a.notes,
      }));
      const { data } = await api.post(`/events/${selectedEvent.id}/attendees`, { attendees });
      toast.success(`Asistencia guardada: ${data.attendees_count} asistentes, ${data.faith_decisions} decisiones de fe`);
      setShowAttendeesModal(false);
      loadEvents(pagination.page); // Recargar para ver contadores actualizados
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar asistencia');
    } finally {
      setSavingAttendees(false);
    }
  };

  // Filtro de búsqueda de miembros
  const filteredMembers = allMembers.filter((m) => {
    if (!memberSearch) return true;
    return `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase());
  });

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Contadores en tiempo real
  const attendedCount = attendeesList.filter((a) => a.attended).length;
  const faithCount = attendeesList.filter((a) => a.made_faith_decision).length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Eventos</Typography>
        {hasRole('Administrador', 'Secretaría', 'Líder') && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Nuevo Evento</Button>
        )}
      </Box>

      {/* Tabla de eventos */}
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Título</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Tipo</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Fecha</TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Ubicación</TableCell>
                <TableCell align="center">Asist.</TableCell>
                <TableCell align="center">Dec. Fe</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
              ) : events.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>No hay eventos registrados</TableCell></TableRow>
              ) : events.map((ev) => (
                <TableRow key={ev.id} hover>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={14}>{ev.title}</Typography>
                    {/* En móvil mostrar tipo y fecha debajo del título */}
                    <Typography variant="caption" color="text.secondary" sx={{ display: { sm: 'none' } }}>
                      {ev.event_type} • {formatDate(ev.start_date)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    <Chip label={ev.event_type} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{formatDate(ev.start_date)}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>{ev.location || '-'}</TableCell>
                  <TableCell align="center">
                    <Chip label={ev.attendees_count} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={ev.faith_decisions} size="small" color="error" variant={ev.faith_decisions > 0 ? 'filled' : 'outlined'} />
                  </TableCell>
                  <TableCell align="right">
                    {hasRole('Administrador', 'Secretaría', 'Líder') && (
                      <>
                        <IconButton size="small" onClick={() => openAttendees(ev)} color="success" title="Gestionar asistentes">
                          <PeopleIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => openEdit(ev)} color="primary" title="Editar">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                    {hasRole('Administrador') && (
                      <IconButton size="small" onClick={() => handleDelete(ev.id)} color="error" title="Eliminar">
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
          onPageChange={(_, p) => loadEvents(p)} rowsPerPage={15} rowsPerPageOptions={[15]}
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`} />
      </Paper>

      {/* ===== DIALOG CREAR/EDITAR EVENTO ===== */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editing ? 'Editar Evento' : 'Nuevo Evento'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField fullWidth required size="small" label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tipo</InputLabel>
                  <Select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} label="Tipo">
                    {EVENT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Ubicación" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required size="small" label="Inicio" type="datetime-local" InputLabelProps={{ shrink: true }}
                  value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Fin" type="datetime-local" InputLabelProps={{ shrink: true }}
                  value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Descripción" multiline rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="contained" type="submit">{editing ? 'Actualizar' : 'Crear Evento'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ===== DIALOG ASISTENTES ===== */}
      <Dialog open={showAttendeesModal} onClose={() => setShowAttendeesModal(false)}
        maxWidth="md" fullWidth fullScreen={window.innerWidth < 600}>
        <DialogTitle sx={{ pb: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h6">Asistencia: {selectedEvent?.title}</Typography>
              <Typography variant="caption" color="text.secondary">{formatDate(selectedEvent?.start_date)}</Typography>
            </Box>
            <IconButton onClick={() => setShowAttendeesModal(false)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={2} sx={{ height: { xs: 'auto', sm: '55vh' } }}>
            {/* Panel izquierdo: Agregar miembros */}
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" gutterBottom>Agregar Miembros</Typography>
              <TextField fullWidth size="small" placeholder="Buscar miembro..." value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)} sx={{ mb: 1 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
              <Button fullWidth size="small" variant="outlined" startIcon={<SelectAllIcon />}
                onClick={addAllMembers} sx={{ mb: 1 }}>Agregar todos</Button>
              <Box sx={{ maxHeight: { xs: 200, sm: '42vh' }, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <List dense disablePadding>
                  {filteredMembers.map((m) => {
                    const isAdded = attendeesList.some((a) => a.member_id === m.id);
                    return (
                      <ListItem key={m.id} button disabled={isAdded}
                        onClick={() => !isAdded && addMemberToAttendees(m)}
                        sx={{ opacity: isAdded ? 0.5 : 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <ListItemText primary={`${m.first_name} ${m.last_name}`}
                          primaryTypographyProps={{ fontSize: 13 }} />
                        <Chip label={m.member_type} size="small" sx={{ fontSize: 10, height: 20 }} />
                        {isAdded && <CheckIcon fontSize="small" color="success" sx={{ ml: 0.5 }} />}
                      </ListItem>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                      No se encontraron miembros
                    </Typography>
                  )}
                </List>
              </Box>
            </Grid>

            {/* Panel derecho: Lista de asistentes con controles */}
            <Grid item xs={12} sm={8}>
              {/* Resumen con contadores */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2">Lista de Asistentes ({attendeesList.length})</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip icon={<CheckIcon />} label={`Asistieron: ${attendedCount}`} size="small" color="primary" variant="outlined" />
                  <Chip icon={<FavoriteIcon />} label={`Dec. Fe: ${faithCount}`} size="small" color="error" variant="outlined" />
                </Box>
              </Box>

              {attendeesList.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No hay asistentes. Seleccione miembros del panel izquierdo.
                </Alert>
              ) : (
                <Box sx={{ maxHeight: { xs: 300, sm: '46vh' }, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Nombre</TableCell>
                        <TableCell align="center" sx={{ width: 70 }}>Asistió</TableCell>
                        <TableCell align="center" sx={{ width: 70 }}>Dec. Fe</TableCell>
                        <TableCell align="center" sx={{ width: 50 }}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {attendeesList.map((a) => (
                        <TableRow key={a.member_id} hover>
                          <TableCell>
                            <Typography fontSize={13}>{a.full_name}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox size="small" checked={a.attended}
                              onChange={() => toggleAttended(a.member_id)}
                              color="success" />
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox size="small" checked={a.made_faith_decision}
                              onChange={() => toggleFaithDecision(a.member_id)}
                              icon={<FavoriteIcon sx={{ color: '#ddd' }} />}
                              checkedIcon={<FavoriteIcon />}
                              color="error" />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" onClick={() => removeMember(a.member_id)} color="error">
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setShowAttendeesModal(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveAttendees}
            disabled={savingAttendees || attendeesList.length === 0}
            startIcon={savingAttendees ? <CircularProgress size={18} color="inherit" /> : <PeopleIcon />}>
            {savingAttendees ? 'Guardando...' : 'Guardar Asistencia'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Events;

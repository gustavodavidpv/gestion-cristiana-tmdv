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
  CalendarMonth as CalendarIcon,
  Storefront as StorefrontIcon,
} from '@mui/icons-material';

const EVENT_TYPES = ['Evangelismo', 'Culto', 'Reunión', 'Jornada', 'Conferencia', 'Campamento', 'Ventas', 'Otro'];

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
    // Roles de culto (solo aplican si event_type === 'Culto')
    preacher_id: '', worship_leader_id: '', singer_id: '',
  });

  /**
   * Lista de miembros para los selectores de roles de culto (P, D, C).
   * Se carga al abrir el modal de crear/editar si el tipo es 'Culto',
   * o al cambiar el tipo a 'Culto'.
   */
  const [cultoMembers, setCultoMembers] = useState([]);

  // Estado del modal de asistentes
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [attendeesList, setAttendeesList] = useState([]); // Lista de asistentes del evento
  const [memberSearch, setMemberSearch] = useState('');
  const [savingAttendees, setSavingAttendees] = useState(false);

  // === Estado del modal de Calendario PDF ===
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // === Estado del modal de Calendario de Ventas PDF ===
  const [showSalesCalendarModal, setShowSalesCalendarModal] = useState(false);
  const [salesCalendarYear, setSalesCalendarYear] = useState(new Date().getFullYear());
  const [downloadingSalesPdf, setDownloadingSalesPdf] = useState(false);

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

  /**
   * Carga la lista de miembros para los selectores de roles de culto.
   * Se ejecuta al abrir el modal de evento cuando el tipo es 'Culto'.
   */
  const loadCultoMembers = useCallback(async () => {
    try {
      const { data } = await api.get('/members', { params: { limit: 500 } });
      setCultoMembers(data.members || []);
    } catch (error) {
      console.error('Error al cargar miembros para roles de culto:', error);
    }
  }, []);

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
      // Cargar roles de culto existentes (vacío si no aplica)
      preacher_id: event.preacher_id || '',
      worship_leader_id: event.worship_leader_id || '',
      singer_id: event.singer_id || '',
    });
    // Si es tipo Culto, cargar miembros para los selectores
    if (event.event_type === 'Culto') loadCultoMembers();
    setShowModal(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      title: '', description: '', event_type: 'Evangelismo',
      start_date: '', end_date: '', location: '',
      preacher_id: '', worship_leader_id: '', singer_id: '',
    });
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

  // ===== DESCARGA DE CALENDARIO PDF =====

  /** Nombres de meses en español para el selector */
  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  /**
   * Descarga el calendario PDF del mes seleccionado.
   * Llama al endpoint GET /api/events/calendar-pdf?year=YYYY&month=MM
   * y descarga el archivo PDF resultante.
   */
  const downloadCalendarPdf = async () => {
    setDownloadingPdf(true);
    try {
      const response = await api.get('/events/calendar-pdf', {
        params: { year: calendarYear, month: calendarMonth },
        responseType: 'blob', // Importante: recibir como binario
      });

      // Crear un enlace temporal para descargar el blob
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Calendario_${MONTH_NAMES[calendarMonth - 1]}_${calendarYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Calendario de ${MONTH_NAMES[calendarMonth - 1]} ${calendarYear} descargado`);
      setShowCalendarModal(false);
    } catch (error) {
      toast.error('Error al generar el calendario PDF');
      console.error('Error descargando calendario:', error);
    } finally {
      setDownloadingPdf(false);
    }
  };

  /**
   * Descarga el Calendario de Ventas PDF del año seleccionado.
   * Llama al endpoint GET /api/events/sales-calendar-pdf?year=YYYY
   * y descarga el PDF con formato de columnas por mes (estilo de la imagen de referencia).
   */
  const downloadSalesCalendarPdf = async () => {
    setDownloadingSalesPdf(true);
    try {
      const response = await api.get('/events/sales-calendar-pdf', {
        params: { year: salesCalendarYear },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Calendario_Ventas_${salesCalendarYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Calendario de Ventas ${salesCalendarYear} descargado`);
      setShowSalesCalendarModal(false);
    } catch (error) {
      toast.error('Error al generar el calendario de ventas PDF');
      console.error('Error descargando calendario ventas:', error);
    } finally {
      setDownloadingSalesPdf(false);
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
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {/* Botón Calendario PDF mensual */}
          <Button variant="outlined" startIcon={<CalendarIcon />}
            onClick={() => setShowCalendarModal(true)}
            color="secondary">
            Calendario PDF
          </Button>
          {/* Botón Calendario de Ventas PDF (muestra todos los meses con eventos tipo Ventas) */}
          <Button variant="outlined" startIcon={<StorefrontIcon />}
            onClick={() => setShowSalesCalendarModal(true)}
            color="warning">
            Ventas PDF
          </Button>
          {hasRole('Administrador', 'Secretaría', 'Líder') && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Nuevo Evento</Button>
          )}
        </Box>
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
                    {/* Mostrar roles de culto (P, D, C) debajo del título si es tipo Culto */}
                    {ev.event_type === 'Culto' && (ev.preacher || ev.worship_leader || ev.singer) && (
                      <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {ev.preacher && (
                          <Chip label={`P: ${ev.preacher.first_name} ${ev.preacher.last_name}`}
                            size="small" variant="outlined" color="primary"
                            sx={{ fontSize: 11, height: 22 }} />
                        )}
                        {ev.worship_leader && (
                          <Chip label={`D: ${ev.worship_leader.first_name} ${ev.worship_leader.last_name}`}
                            size="small" variant="outlined" color="secondary"
                            sx={{ fontSize: 11, height: 22 }} />
                        )}
                        {ev.singer && (
                          <Chip label={`C: ${ev.singer.first_name} ${ev.singer.last_name}`}
                            size="small" variant="outlined" color="success"
                            sx={{ fontSize: 11, height: 22 }} />
                        )}
                      </Box>
                    )}
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
                  <Select value={form.event_type} onChange={(e) => {
                    const newType = e.target.value;
                    setForm({ ...form, event_type: newType });
                    // Si cambió a Culto, cargar lista de miembros para los selectores P/D/C
                    if (newType === 'Culto' && cultoMembers.length === 0) loadCultoMembers();
                    // Si cambió de Culto a otro tipo, limpiar roles
                    if (newType !== 'Culto') {
                      setForm((prev) => ({ ...prev, event_type: newType, preacher_id: '', worship_leader_id: '', singer_id: '' }));
                    }
                  }} label="Tipo">
                    {EVENT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Ubicación" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Grid>

              {/* ===== ROLES DE CULTO (solo visible si event_type === 'Culto') ===== */}
              {form.event_type === 'Culto' && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="subtitle2" color="primary" sx={{ mt: 1 }}>
                      🎤 Asignación de Roles del Culto
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Seleccione quién predica, dirige y canta en este culto.
                    </Typography>
                  </Grid>
                  {/* Selector: Predica (P) */}
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Predica (P)</InputLabel>
                      <Select value={form.preacher_id}
                        onChange={(e) => setForm({ ...form, preacher_id: e.target.value })}
                        label="Predica (P)">
                        <MenuItem value=""><em>— Sin asignar —</em></MenuItem>
                        {cultoMembers.map((m) => (
                          <MenuItem key={m.id} value={m.id}>
                            {m.first_name} {m.last_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* Selector: Dirige (D) */}
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Dirige (D)</InputLabel>
                      <Select value={form.worship_leader_id}
                        onChange={(e) => setForm({ ...form, worship_leader_id: e.target.value })}
                        label="Dirige (D)">
                        <MenuItem value=""><em>— Sin asignar —</em></MenuItem>
                        {cultoMembers.map((m) => (
                          <MenuItem key={m.id} value={m.id}>
                            {m.first_name} {m.last_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* Selector: Canta (C) */}
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Canta (C)</InputLabel>
                      <Select value={form.singer_id}
                        onChange={(e) => setForm({ ...form, singer_id: e.target.value })}
                        label="Canta (C)">
                        <MenuItem value=""><em>— Sin asignar —</em></MenuItem>
                        {cultoMembers.map((m) => (
                          <MenuItem key={m.id} value={m.id}>
                            {m.first_name} {m.last_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}
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

      {/* ===== DIALOG SELECCIONAR MES PARA CALENDARIO PDF ===== */}
      <Dialog open={showCalendarModal} onClose={() => setShowCalendarModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarIcon color="secondary" />
            Descargar Calendario PDF
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Seleccione el mes y año para generar el calendario de eventos en formato PDF.
          </Typography>
          <Grid container spacing={2}>
            {/* Selector de Mes */}
            <Grid item xs={7}>
              <FormControl fullWidth size="small">
                <InputLabel>Mes</InputLabel>
                <Select value={calendarMonth}
                  onChange={(e) => setCalendarMonth(e.target.value)} label="Mes">
                  {MONTH_NAMES.map((name, i) => (
                    <MenuItem key={i + 1} value={i + 1}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {/* Selector de Año */}
            <Grid item xs={5}>
              <TextField fullWidth size="small" label="Año" type="number"
                value={calendarYear}
                onChange={(e) => setCalendarYear(parseInt(e.target.value))}
                inputProps={{ min: 2020, max: 2040 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setShowCalendarModal(false)}>Cancelar</Button>
          <Button variant="contained" color="secondary"
            onClick={downloadCalendarPdf}
            disabled={downloadingPdf}
            startIcon={downloadingPdf ? <CircularProgress size={18} color="inherit" /> : <CalendarIcon />}>
            {downloadingPdf ? 'Generando...' : 'Descargar PDF'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== DIALOG SELECCIONAR AÑO PARA CALENDARIO DE VENTAS PDF ===== */}
      <Dialog open={showSalesCalendarModal} onClose={() => setShowSalesCalendarModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorefrontIcon color="warning" />
            Calendario de Ventas PDF
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Genera un calendario con todos los eventos de tipo <strong>Ventas</strong> del año,
            organizado por meses en columnas (estilo calendario de ventas).
          </Typography>
          <TextField fullWidth size="small" label="Año" type="number"
            value={salesCalendarYear}
            onChange={(e) => setSalesCalendarYear(parseInt(e.target.value))}
            inputProps={{ min: 2020, max: 2040 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setShowSalesCalendarModal(false)}>Cancelar</Button>
          <Button variant="contained" color="warning"
            onClick={downloadSalesCalendarPdf}
            disabled={downloadingSalesPdf}
            startIcon={downloadingSalesPdf ? <CircularProgress size={18} color="inherit" /> : <StorefrontIcon />}>
            {downloadingSalesPdf ? 'Generando...' : 'Descargar Ventas PDF'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Events;

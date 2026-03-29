/**
 * Events.js - Gestión de eventos con asistencia y decisiones de fe (MUI)
 *
 * FIXES IMPLEMENTADOS:
 * 1. Prevención de duplicados en frontend (deduplicación por member_id)
 * 2. El backend usa REPLACE strategy (borra + inserta) con transacción
 * 3. Contadores de asistencia y decisiones de fe se calculan en tiempo real
 * 4. Las decisiones de fe se propagan automáticamente a la iglesia
 *
 * SUPERADMIN: Usa ChurchSelector para seleccionar iglesia primero.
 * Al entrar a una iglesia, los eventos se filtran por church_id.
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import ChurchSelector from '../components/layout/ChurchSelector';
import {
  Box, Paper, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, CircularProgress, TablePagination, InputAdornment, Divider,
  List, ListItem, ListItemText, Checkbox,
  Alert, useMediaQuery, useTheme,
  ToggleButton, ToggleButtonGroup, Tooltip, Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  People as PeopleIcon, Search as SearchIcon,
  CheckCircle as CheckIcon, Favorite as FavoriteIcon,
  Close as CloseIcon, SelectAll as SelectAllIcon,
  CalendarMonth as CalendarIcon,
  Storefront as StorefrontIcon,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  ViewList as ViewListIcon, TableChart as TableIcon,
  Today as TodayIcon,
} from '@mui/icons-material';

const EVENT_TYPES = ['Evangelismo', 'Culto', 'Culto Especial', 'Reunión', 'Jornada', 'Conferencia', 'Campamento', 'Ventas', 'Otro'];

// =============================================
// CONSTANTES Y UTILIDADES PARA VISTA DE CALENDARIO
// =============================================

/** Colores de fondo/texto/borde por tipo de evento (replicados del PDF calendarPdf.js) */
const EVENT_COLORS = {
  'Evangelismo':  { bg: '#E8F5E9', text: '#1B5E20', border: '#66BB6A' },
  'Culto':        { bg: '#E3F2FD', text: '#0D47A1', border: '#42A5F5' },
  'Culto Especial': { bg: '#E8EAF6', text: '#1A237E', border: '#5C6BC0' },
  'Reunión':      { bg: '#FFF3E0', text: '#E65100', border: '#FFA726' },
  'Jornada':      { bg: '#F3E5F5', text: '#4A148C', border: '#AB47BC' },
  'Conferencia':  { bg: '#FCE4EC', text: '#880E4F', border: '#EC407A' },
  'Campamento':   { bg: '#E0F7FA', text: '#006064', border: '#26C6DA' },
  'Ventas':       { bg: '#FFF8E1', text: '#F57F17', border: '#FFB300' },
  'Otro':         { bg: '#F5F5F5', text: '#424242', border: '#BDBDBD' },
};

/** Retorna true si el tipo de evento es un culto (normal o especial) con roles P/D/C */
const isCultoType = (type) => type === 'Culto' || type === 'Culto Especial';

/** Nombres cortos de días para el header del calendario (Domingo = index 0) */
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Nombres completos de meses en español para la navegación */
const MONTH_NAMES_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Genera la grilla del calendario para un mes dado.
 * Retorna un array de semanas, donde cada semana es un array de 7 elementos
 * (Dom=0 a Sáb=6) con el número de día o null si no pertenece al mes.
 *
 * Portado de server/utils/calendarPdf.js:getCalendarGrid
 *
 * @param {number} year - Año (ej: 2026)
 * @param {number} month - Mes (1-12)
 * @returns {Array<Array<number|null>>} Semanas del mes
 */
function getCalendarGrid(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  let currentWeek = new Array(7).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay(); // 0=Dom, 6=Sáb
    currentWeek[dow] = day;
    // Cerrar semana al llegar a Sábado o al último día del mes
    if (dow === 6 || day === daysInMonth) {
      weeks.push([...currentWeek]);
      currentWeek = new Array(7).fill(null);
    }
  }
  return weeks;
}

/**
 * Formatea hora de un Date como HH:MM (24h).
 * @param {string|Date} date - Fecha/hora
 * @returns {string} Hora formateada
 */
function formatTimeShort(date) {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Convierte un ISO timestamp a formato compatible con input datetime-local
 * respetando la zona horaria local del navegador.
 * Ej: "2026-03-29T00:00:00.000Z" → "2026-03-28T19:00" (en UTC-5)
 * @param {string} isoStr - Fecha ISO del servidor
 * @returns {string} Formato "YYYY-MM-DDTHH:MM" en hora local
 */
function toLocalDatetimeStr(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Expande un evento en "ocurrencias" por día para la vista de calendario.
 * Maneja eventos de un solo día y eventos multi-día con indicadores visuales.
 *
 * Portado y simplificado de server/utils/calendarPdf.js:expandEventToDays
 *
 * Reglas:
 * - Mismo día: label = "HH:MM-HH:MM", dayType = 'single'
 * - Primer día: label = "HH:MM ▶", dayType = 'start'
 * - Días intermedios: label = "completo", dayType = 'middle'
 * - Último día: label = "▶ HH:MM", dayType = 'end'
 *
 * @param {Object} ev - Evento completo del API (con start_date, end_date, title, event_type, etc.)
 * @param {number} year - Año del calendario
 * @param {number} month - Mes del calendario (1-12)
 * @returns {Array} Ocurrencias: { day, label, title, event_type, dayType, sortTime, event }
 */
function expandEventToDays(ev, year, month) {
  const start = new Date(ev.start_date);
  const end = ev.end_date ? new Date(ev.end_date) : start;

  // Comparar solo fechas (sin hora) para determinar si es multi-día
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const isSameDay = startDay.getTime() === endDay.getTime();

  const occurrences = [];
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

  // Iterar desde el mayor entre startDay y el inicio del mes,
  // hasta el menor entre endDay y el fin del mes
  let current = new Date(Math.max(startDay.getTime(), firstDayOfMonth.getTime()));
  const limit = new Date(Math.min(endDay.getTime(), lastDayOfMonth.getTime()));

  while (current <= limit) {
    const day = current.getDate();
    const isFirstDay = current.getTime() === startDay.getTime();
    const isLastDay = current.getTime() === endDay.getTime();

    let label, dayType, sortTime;

    if (isSameDay) {
      // Evento de un solo día: mostrar hora inicio-fin
      const startT = formatTimeShort(start);
      const endT = ev.end_date ? `-${formatTimeShort(end)}` : '';
      label = `${startT}${endT}`;
      dayType = 'single';
      sortTime = start.getHours() * 60 + start.getMinutes();
    } else if (isFirstDay) {
      label = `${formatTimeShort(start)} ▶`;
      dayType = 'start';
      sortTime = start.getHours() * 60 + start.getMinutes();
    } else if (isLastDay) {
      label = `▶ ${formatTimeShort(end)}`;
      dayType = 'end';
      sortTime = 0;
    } else {
      label = 'completo';
      dayType = 'middle';
      sortTime = 0;
    }

    occurrences.push({
      day,
      label,
      title: ev.title,
      event_type: ev.event_type,
      dayType,
      sortTime,
      event: ev, // Referencia al evento completo para manejar clicks
    });

    // Avanzar al siguiente día
    current.setDate(current.getDate() + 1);
  }

  return occurrences;
}

/**
 * EventsContent - Contenido principal del módulo de eventos.
 * Recibe churchId y churchName del ChurchSelector (null si no es SuperAdmin).
 */
const EventsContent = ({ churchId, churchName, backButton }) => {
  const { hasRole } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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

  // === Estado de la vista de calendario/lista ===
  // viewMode: 'calendar' (grilla desktop), 'list' (lista móvil), 'table' (tabla paginada original)
  const [viewMode, setViewMode] = useState(isMobile ? 'list' : 'calendar');
  const [calViewYear, setCalViewYear] = useState(new Date().getFullYear());
  const [calViewMonth, setCalViewMonth] = useState(new Date().getMonth() + 1);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // ===== CARGA DE EVENTOS =====
  const loadEvents = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const params = { page: page + 1, limit: 15 };
      // SuperAdmin: filtrar por la iglesia seleccionada
      if (churchId) params.church_id = churchId;
      const { data } = await api.get('/events', { params });
      setEvents(data.events);
      setPagination({ page, total: data.pagination.total });
    } catch (error) {
      toast.error('Error al cargar eventos');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ===== CARGA DE EVENTOS PARA CALENDARIO/LISTA =====

  /**
   * Carga todos los eventos del mes seleccionado para las vistas de calendario y lista.
   * Usa un buffer de 31 días antes del inicio del mes para capturar eventos multi-día
   * que empezaron en el mes anterior pero se extienden al mes actual.
   * No usa paginación (limit: 500) porque necesitamos todos los eventos del mes.
   */
  const loadCalendarEvents = useCallback(async () => {
    setLoadingCalendar(true);
    try {
      // Buffer de 31 días para capturar eventos multi-día del mes anterior
      const monthStart = new Date(calViewYear, calViewMonth - 1, 1);
      const bufferStart = new Date(monthStart);
      bufferStart.setDate(bufferStart.getDate() - 31);
      const monthEnd = new Date(calViewYear, calViewMonth, 0, 23, 59, 59);

      const params = {
        start_date: bufferStart.toISOString(),
        end_date: monthEnd.toISOString(),
        limit: 500,
        page: 1,
      };
      if (churchId) params.church_id = churchId;

      const { data } = await api.get('/events', { params });
      setCalendarEvents(data.events || []);
    } catch (error) {
      toast.error('Error al cargar eventos del calendario');
    } finally {
      setLoadingCalendar(false);
    }
  }, [calViewYear, calViewMonth, churchId]);

  /** Cargar eventos del calendario cuando cambia el mes/año o el modo de vista */
  useEffect(() => {
    if (viewMode === 'calendar' || viewMode === 'list') {
      loadCalendarEvents();
    }
  }, [viewMode, loadCalendarEvents]);

  // ===== NAVEGACIÓN DE MESES =====

  /** Avanza o retrocede un mes en la vista de calendario/lista */
  const navigateMonth = (delta) => {
    let newMonth = calViewMonth + delta;
    let newYear = calViewYear;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setCalViewMonth(newMonth);
    setCalViewYear(newYear);
  };

  /** Vuelve al mes actual */
  const goToToday = () => {
    setCalViewMonth(new Date().getMonth() + 1);
    setCalViewYear(new Date().getFullYear());
  };

  /**
   * Carga la lista de miembros para los selectores de roles de culto.
   * Se ejecuta al abrir el modal de evento cuando el tipo es 'Culto'.
   */
  const loadCultoMembers = useCallback(async () => {
    try {
      const params = { limit: 500 };
      if (churchId) params.church_id = churchId;
      const { data } = await api.get('/members', { params });
      setCultoMembers(data.members || []);
    } catch (error) {
      console.error('Error al cargar miembros para roles de culto:', error);
    }
  }, [churchId]);

  // ===== CRUD DE EVENTOS =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      // SuperAdmin: enviar church_id explícitamente al crear
      if (churchId && !editing) {
        payload.church_id = churchId;
      }

      if (editing) {
        await api.put(`/events/${editing.id}`, payload);
        toast.success('Evento actualizado');
      } else {
        await api.post('/events', payload);
        toast.success('Evento creado');
      }
      setShowModal(false);
      loadEvents(pagination.page);
      // Recargar calendario/lista si están activos
      if (viewMode !== 'table') loadCalendarEvents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  const openEdit = (event) => {
    setEditing(event);
    setForm({
      title: event.title, description: event.description || '',
      event_type: event.event_type || 'Evangelismo',
      // Convertir ISO a hora local del navegador para el input datetime-local
      start_date: toLocalDatetimeStr(event.start_date),
      end_date: toLocalDatetimeStr(event.end_date),
      location: event.location || '',
      // Cargar roles de culto existentes (vacío si no aplica)
      preacher_id: event.preacher_id || '',
      worship_leader_id: event.worship_leader_id || '',
      singer_id: event.singer_id || '',
    });
    // Si es tipo Culto, cargar miembros para los selectores
    if (isCultoType(event.event_type)) loadCultoMembers();
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
      // Recargar calendario/lista si están activos
      if (viewMode !== 'table') loadCalendarEvents();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  // ===== GESTIÓN DE ASISTENTES =====

  /**
   * Abre el modal de asistentes cargando:
   * 1. Todos los miembros disponibles (filtrados por iglesia si aplica)
   * 2. Los asistentes ya registrados en el evento
   */
  const openAttendees = async (event) => {
    setSelectedEvent(event);
    setMemberSearch('');
    try {
      const membersParams = { limit: 500 };
      if (churchId) membersParams.church_id = churchId;

      // Cargar miembros y detalle del evento en paralelo
      const [membersRes, eventRes] = await Promise.all([
        api.get('/members', { params: membersParams }),
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
      // Recargar calendario/lista si están activos
      if (viewMode !== 'table') loadCalendarEvents();
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
      const params = { year: calendarYear, month: calendarMonth };
      if (churchId) params.church_id = churchId;
      const response = await api.get('/events/calendar-pdf', {
        params,
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
      const params = { year: salesCalendarYear };
      if (churchId) params.church_id = churchId;
      const response = await api.get('/events/sales-calendar-pdf', {
        params,
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
      {/* Botón volver (solo SuperAdmin con iglesia seleccionada) */}
      {backButton}

      {/* Header con título, toggle de vistas y acciones */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          Eventos{churchName ? ` — ${churchName}` : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Toggle de vista: Calendario (solo desktop) | Lista | Tabla */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => { if (newMode) setViewMode(newMode); }}
            size="small"
          >
            {/* Calendario solo visible en pantallas sm+ (no en móvil) */}
            <ToggleButton value="calendar" sx={{ display: { xs: 'none', sm: 'flex' } }}>
              <Tooltip title="Calendario"><CalendarIcon fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="list">
              <Tooltip title="Lista"><ViewListIcon fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="table">
              <Tooltip title="Tabla"><TableIcon fontSize="small" /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          {/* Botón Calendario PDF mensual */}
          <Button variant="outlined" startIcon={<CalendarIcon />}
            onClick={() => setShowCalendarModal(true)}
            color="secondary" size="small">
            Calendario PDF
          </Button>
          {/* Botón Calendario de Ventas PDF (muestra todos los meses con eventos tipo Ventas) */}
          <Button variant="outlined" startIcon={<StorefrontIcon />}
            onClick={() => setShowSalesCalendarModal(true)}
            color="warning" size="small">
            Ventas PDF
          </Button>
          {hasRole('Administrador', 'Secretaría', 'Líder') && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Nuevo Evento</Button>
          )}
        </Box>
      </Box>

      {/* ===== VISTA CALENDARIO (Desktop) ===== */}
      {viewMode === 'calendar' && (() => {
        // Expandir todos los eventos del mes en ocurrencias por día
        const eventsByDay = {};
        calendarEvents.forEach((ev) => {
          const occurrences = expandEventToDays(ev, calViewYear, calViewMonth);
          occurrences.forEach((occ) => {
            if (!eventsByDay[occ.day]) eventsByDay[occ.day] = [];
            eventsByDay[occ.day].push(occ);
          });
        });
        // Ordenar eventos dentro de cada día por hora de inicio
        Object.keys(eventsByDay).forEach((day) => {
          eventsByDay[day].sort((a, b) => a.sortTime - b.sortTime);
        });

        const weeks = getCalendarGrid(calViewYear, calViewMonth);
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === calViewYear && today.getMonth() + 1 === calViewMonth;
        const todayDay = today.getDate();
        /** Máximo de eventos visibles por celda antes de mostrar "+N más" */
        const MAX_VISIBLE_EVENTS = 3;

        return (
          <Paper sx={{ overflow: 'hidden' }}>
            {/* Barra de navegación de meses */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, bgcolor: '#0D47A1', color: '#fff' }}>
              <IconButton onClick={() => navigateMonth(-1)} sx={{ color: '#fff' }}>
                <ChevronLeftIcon />
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" fontWeight={700}>
                  {MONTH_NAMES_FULL[calViewMonth - 1]} {calViewYear}
                </Typography>
                <Button size="small" variant="outlined" startIcon={<TodayIcon />}
                  onClick={goToToday}
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)', ml: 1, textTransform: 'none', '&:hover': { borderColor: '#fff' } }}>
                  Hoy
                </Button>
              </Box>
              <IconButton onClick={() => navigateMonth(1)} sx={{ color: '#fff' }}>
                <ChevronRightIcon />
              </IconButton>
            </Box>

            {/* Header de días de la semana */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {DAY_NAMES_SHORT.map((dayName, i) => (
                <Box key={dayName} sx={{
                  py: 1, textAlign: 'center',
                  bgcolor: i === 0 ? '#1565C0' : '#1E88E5',
                  borderRight: i < 6 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                }}>
                  <Typography variant="caption" fontWeight={700} color="#fff">{dayName}</Typography>
                </Box>
              ))}
            </Box>

            {/* Grilla del calendario */}
            {loadingCalendar ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              weeks.map((week, weekIdx) => (
                <Box key={weekIdx} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {week.map((day, colIdx) => {
                    const isWeekend = colIdx === 0 || colIdx === 6;
                    const isToday = isCurrentMonth && day === todayDay;
                    const dayEvents = day ? (eventsByDay[day] || []) : [];
                    const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
                    const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS;

                    return (
                      <Box key={colIdx} sx={{
                        minHeight: 110,
                        borderRight: '1px solid', borderBottom: '1px solid',
                        borderColor: 'divider',
                        bgcolor: day === null ? '#F0F0F0' : (isWeekend ? '#F5F8FF' : '#fff'),
                        p: 0.5,
                        overflow: 'hidden',
                      }}>
                        {day !== null && (
                          <>
                            {/* Número del día, resaltado si es hoy */}
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 26, height: 26, borderRadius: '50%', mb: 0.5,
                                color: isToday ? '#fff' : (colIdx === 0 ? '#C62828' : 'text.primary'),
                                bgcolor: isToday ? '#1565C0' : 'transparent',
                              }}
                            >
                              {day}
                            </Typography>

                            {/* Eventos del día */}
                            {visibleEvents.map((occ, occIdx) => {
                              const colors = EVENT_COLORS[occ.event_type] || EVENT_COLORS['Otro'];
                              return (
                                <Tooltip key={occIdx} title={`${occ.label} — ${occ.title}`} arrow placement="top">
                                  <Box
                                    onClick={() => openEdit(occ.event)}
                                    sx={{
                                      display: 'flex', alignItems: 'center', gap: 0.5,
                                      bgcolor: colors.bg,
                                      borderLeft: `3px solid ${colors.border}`,
                                      borderRadius: '3px',
                                      px: 0.5, py: '2px', mb: '3px',
                                      cursor: 'pointer',
                                      overflow: 'hidden',
                                      '&:hover': { opacity: 0.85, boxShadow: 1 },
                                    }}
                                  >
                                    <Typography noWrap sx={{ fontSize: 11, color: colors.text, fontWeight: 600, lineHeight: 1.3 }}>
                                      {occ.label}
                                    </Typography>
                                    <Typography noWrap sx={{ fontSize: 11, color: colors.text, lineHeight: 1.3, flex: 1 }}>
                                      {occ.title}
                                    </Typography>
                                  </Box>
                                </Tooltip>
                              );
                            })}

                            {/* Indicador de más eventos si excede el máximo visible */}
                            {overflowCount > 0 && (
                              <Typography variant="caption" color="primary" sx={{ cursor: 'pointer', fontWeight: 600, fontSize: 11, pl: 0.5 }}>
                                +{overflowCount} más
                              </Typography>
                            )}
                          </>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              ))
            )}

            {/* Leyenda de colores por tipo de evento */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#FAFAFA' }}>
              {Object.entries(EVENT_COLORS).map(([type, colors]) => (
                <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: colors.border }} />
                  <Typography variant="caption" color="text.secondary">{type}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        );
      })()}

      {/* ===== VISTA LISTA (Móvil / opción en desktop) ===== */}
      {viewMode === 'list' && (() => {
        // Filtrar eventos que realmente pertenecen al mes seleccionado
        // y ordenar por fecha de inicio ascendente
        const monthEvents = calendarEvents
          .filter((ev) => {
            const start = new Date(ev.start_date);
            const end = ev.end_date ? new Date(ev.end_date) : start;
            const monthStart = new Date(calViewYear, calViewMonth - 1, 1);
            const monthEnd = new Date(calViewYear, calViewMonth, 0, 23, 59, 59);
            // El evento se solapa con el mes si: inicio <= finMes AND fin >= inicioMes
            return start <= monthEnd && end >= monthStart;
          })
          .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

        // Agrupar eventos por fecha (día) para mostrar headers de fecha
        const groupedByDate = {};
        monthEvents.forEach((ev) => {
          const dateKey = new Date(ev.start_date).toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long',
          });
          if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
          groupedByDate[dateKey].push(ev);
        });

        return (
          <Box>
            {/* Barra de navegación de meses (compacta para móvil) */}
            <Paper sx={{ mb: 2, overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 1, bgcolor: '#0D47A1', color: '#fff' }}>
                <IconButton onClick={() => navigateMonth(-1)} sx={{ color: '#fff' }} size="small">
                  <ChevronLeftIcon />
                </IconButton>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {MONTH_NAMES_FULL[calViewMonth - 1]} {calViewYear}
                  </Typography>
                  <IconButton onClick={goToToday} sx={{ color: '#fff' }} size="small" title="Ir a hoy">
                    <TodayIcon fontSize="small" />
                  </IconButton>
                </Box>
                <IconButton onClick={() => navigateMonth(1)} sx={{ color: '#fff' }} size="small">
                  <ChevronRightIcon />
                </IconButton>
              </Box>
            </Paper>

            {/* Contenido de la lista */}
            {loadingCalendar ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : monthEvents.length === 0 ? (
              <Alert severity="info">
                No hay eventos en {MONTH_NAMES_FULL[calViewMonth - 1]} {calViewYear}
              </Alert>
            ) : (
              Object.entries(groupedByDate).map(([dateLabel, dateEvents]) => (
                <Box key={dateLabel} sx={{ mb: 2 }}>
                  {/* Header de fecha (ej: "domingo 5 de marzo") */}
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700}
                    sx={{ textTransform: 'capitalize', mb: 1, px: 0.5 }}>
                    {dateLabel}
                  </Typography>

                  {/* Eventos de ese día */}
                  {dateEvents.map((ev) => {
                    const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS['Otro'];
                    return (
                      <Paper key={ev.id} sx={{
                        mb: 1, p: 1.5,
                        borderLeft: `4px solid ${colors.border}`,
                        cursor: 'pointer',
                        '&:hover': { boxShadow: 2 },
                      }}
                        onClick={() => openEdit(ev)}
                      >
                        {/* Título y tipo */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={600} fontSize={14} noWrap>{ev.title}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatTimeShort(ev.start_date)}
                              {ev.end_date ? ` - ${formatTimeShort(ev.end_date)}` : ''}
                              {ev.location ? ` • ${ev.location}` : ''}
                            </Typography>
                          </Box>
                          <Chip label={ev.event_type} size="small" variant="outlined"
                            sx={{ bgcolor: colors.bg, color: colors.text, borderColor: colors.border, fontSize: 11 }} />
                        </Box>

                        {/* Roles de culto si aplica */}
                        {isCultoType(ev.event_type) && (ev.preacher || ev.worship_leader || ev.singer) && (
                          <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {ev.preacher && (
                              <Chip label={`P: ${ev.preacher.first_name}`} size="small" variant="outlined" color="primary" sx={{ fontSize: 10, height: 20 }} />
                            )}
                            {ev.worship_leader && (
                              <Chip label={`D: ${ev.worship_leader.first_name}`} size="small" variant="outlined" color="secondary" sx={{ fontSize: 10, height: 20 }} />
                            )}
                            {ev.singer && (
                              <Chip label={`C: ${ev.singer.first_name}`} size="small" variant="outlined" color="success" sx={{ fontSize: 10, height: 20 }} />
                            )}
                          </Box>
                        )}

                        {/* Contadores y acciones */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Chip icon={<PeopleIcon />} label={ev.attendees_count} size="small" color="primary" variant="outlined" sx={{ fontSize: 11 }} />
                            {ev.faith_decisions > 0 && (
                              <Chip icon={<FavoriteIcon />} label={ev.faith_decisions} size="small" color="error" variant="filled" sx={{ fontSize: 11 }} />
                            )}
                          </Box>
                          {/* Acciones rápidas */}
                          <Box sx={{ display: 'flex', gap: 0 }}
                            onClick={(e) => e.stopPropagation()} /* Evitar que el click en acciones abra editar */
                          >
                            {hasRole('Administrador', 'Secretaría', 'Líder') && (
                              <>
                                <IconButton size="small" onClick={() => openAttendees(ev)} color="success" title="Asistentes">
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
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>
              ))
            )}
          </Box>
        );
      })()}

      {/* ===== VISTA TABLA (original, paginada) ===== */}
      {viewMode === 'table' && <Paper>
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
                    {isCultoType(ev.event_type) && (ev.preacher || ev.worship_leader || ev.singer) && (
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
      </Paper>}

      {/* ===== DIALOG CREAR/EDITAR EVENTO ===== */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="sm" fullWidth
        fullScreen={isMobile}>
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
                    // Si cambió a Culto o Culto Especial, cargar lista de miembros para los selectores P/D/C
                    if (isCultoType(newType) && cultoMembers.length === 0) loadCultoMembers();
                    // Si cambió a un tipo que no es culto, limpiar roles
                    if (!isCultoType(newType)) {
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

              {/* ===== ROLES DE CULTO (visible si es Culto o Culto Especial) ===== */}
              {isCultoType(form.event_type) && (
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
                  {/* Selector con búsqueda: Predica (P) */}
                  <Grid item xs={12} sm={4}>
                    <Autocomplete
                      options={cultoMembers}
                      getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
                      value={cultoMembers.find(m => m.id === form.preacher_id) || null}
                      onChange={(_, newVal) => setForm({ ...form, preacher_id: newVal?.id || '' })}
                      renderInput={(params) => <TextField {...params} size="small" label="Predica (P)" />}
                      isOptionEqualToValue={(opt, val) => opt.id === val.id}
                      noOptionsText="No encontrado"
                      clearText="Limpiar"
                    />
                  </Grid>
                  {/* Selector con búsqueda: Dirige (D) */}
                  <Grid item xs={12} sm={4}>
                    <Autocomplete
                      options={cultoMembers}
                      getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
                      value={cultoMembers.find(m => m.id === form.worship_leader_id) || null}
                      onChange={(_, newVal) => setForm({ ...form, worship_leader_id: newVal?.id || '' })}
                      renderInput={(params) => <TextField {...params} size="small" label="Dirige (D)" />}
                      isOptionEqualToValue={(opt, val) => opt.id === val.id}
                      noOptionsText="No encontrado"
                      clearText="Limpiar"
                    />
                  </Grid>
                  {/* Selector con búsqueda: Canta (C) */}
                  <Grid item xs={12} sm={4}>
                    <Autocomplete
                      options={cultoMembers}
                      getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
                      value={cultoMembers.find(m => m.id === form.singer_id) || null}
                      onChange={(_, newVal) => setForm({ ...form, singer_id: newVal?.id || '' })}
                      renderInput={(params) => <TextField {...params} size="small" label="Canta (C)" />}
                      isOptionEqualToValue={(opt, val) => opt.id === val.id}
                      noOptionsText="No encontrado"
                      clearText="Limpiar"
                    />
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
        maxWidth="md" fullWidth fullScreen={isMobile}>
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

/**
 * Events - Componente principal.
 * Usa ChurchSelector para que SuperAdmin seleccione iglesia primero.
 */
const Events = () => {
  return (
    <ChurchSelector title="Eventos">
      {({ churchId, churchName, backButton }) => (
        <EventsContent
          churchId={churchId}
          churchName={churchName}
          backButton={backButton}
        />
      )}
    </ChurchSelector>
  );
};

export default Events;

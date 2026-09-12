/**
 * BibleClub.js - Club Bíblico (sección de adolescentes)
 *
 * Pensado para usarse desde el celular durante la clase:
 * - Cabecera fija con los salones como chips deslizables
 * - Lista de saldos tipo app (podio, nivel, saldo grande)
 * - Hoja inferior (bottom sheet) con las acciones de cada participante
 * - Botón flotante para registrar los puntos del día
 * - Diálogos a pantalla completa con barra superior fija
 * - Campos de 16px para que el teléfono NO haga zoom al escribir
 * - Persistencia local: recuerda el salón abierto y guarda la hoja en
 *   progreso, así no se pierde nada si se cierra la app a medias
 *
 * PATRÓN SUPERADMIN:
 * - SuperAdmin ve primero la lista de iglesias (ChurchSelector)
 * - Otros roles ven directamente los grupos de su iglesia
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import ChurchSelector from '../components/layout/ChurchSelector';
import { DEFAULT_LEVELS, POINT_REASONS, QUICK_POINTS, TYPE_LABELS } from '../config/bibleClub';
import ScanSheetDialog from '../components/bibleClub/ScanSheetDialog';
import {
  Box, Paper, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  CircularProgress, Switch, FormControlLabel, Divider, Alert, Tooltip,
  InputAdornment, Avatar, Drawer, AppBar, Toolbar, List, ListItemButton,
  ListItemIcon, ListItemText, Fab, Stack, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  MenuBook as MenuBookIcon,
  Redeem as RedeemIcon, History as HistoryIcon, Search as SearchIcon,
  PlaylistAddCheck as PlaylistAddCheckIcon, Groups as GroupsIcon,
  Close as CloseIcon, Remove as RemoveIcon, Clear as ClearIcon,
  MoreVert as MoreVertIcon, DocumentScanner as DocumentScannerIcon,
  PictureAsPdf as PictureAsPdfIcon, EmojiEvents as EmojiEventsIcon,
} from '@mui/icons-material';

/** Offsets del shell de la app (barra superior fija + notch / barra de gestos) */
const TOP_OFFSET = 'calc(var(--app-bar-height) + var(--safe-top))';
const BOTTOM_SAFE = 'var(--safe-bottom)';

/** Claves de persistencia local */
const LS_GROUP = 'bibleClub.groupId';
const LS_DRAFT = (groupId) => `bibleClub.draft.${groupId}`;

/** Fecha (YYYY-MM-DD) del sábado más reciente en o antes de hoy */
const lastSaturday = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); // getDay(): 0=Dom ... 6=Sáb
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Formatea "YYYY-MM-DD" como "dd/mm/yyyy" sin que el timezone corra el día */
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const [y, m, d] = String(dateStr).split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

/** Lectura tolerante de localStorage (modo privado del navegador puede fallar) */
const readLS = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const writeLS = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* sin persistencia, no es crítico */ }
};
const removeLS = (key) => {
  try { localStorage.removeItem(key); } catch { /* idem */ }
};

/** Colores del podio para los tres primeros lugares */
const PODIUM = ['#F9A825', '#90A4AE', '#A1887F'];

/** Chip de nivel con el color configurado en el grupo */
const LevelChip = ({ level, size = 'small' }) => {
  if (!level) return <Chip label="-" size={size} variant="outlined" />;
  return (
    <Chip
      label={level.name}
      size={size}
      sx={{ bgcolor: level.color, color: '#fff', fontWeight: 700, height: 22 }}
    />
  );
};

/** Barra superior de los diálogos a pantalla completa (patrón de app móvil) */
const SheetHeader = ({ title, subtitle, onClose, action }) => (
  <AppBar position="sticky" elevation={0} color="inherit"
    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
    <Toolbar sx={{ gap: 1 }}>
      <IconButton edge="start" onClick={onClose} aria-label="Cerrar"><CloseIcon /></IconButton>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" fontWeight={700} noWrap>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary" noWrap>{subtitle}</Typography>}
      </Box>
      {action}
    </Toolbar>
  </AppBar>
);

// ========================================================
// CONTENIDO PRINCIPAL
// ========================================================
const BibleClubContent = ({ churchId, backButton }) => {
  const { hasPermission } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const canCreate = hasPermission('bible_club', 'create');
  const canEdit = hasPermission('bible_club', 'edit');
  const canDelete = hasPermission('bible_club', 'delete');

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Dialogs / hojas
  const [groupDialog, setGroupDialog] = useState(null);
  const [studentDialog, setStudentDialog] = useState(null);
  const [pointsDialog, setPointsDialog] = useState(null);
  const [redeemDialog, setRedeemDialog] = useState(null);
  const [historyDialog, setHistoryDialog] = useState(null);
  const [actionSheet, setActionSheet] = useState(null);  // participante seleccionado
  const [groupMenu, setGroupMenu] = useState(false);     // hoja de opciones del salón

  // Filtros dentro del diálogo de puntos
  const [pointsSearch, setPointsSearch] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const params = useMemo(() => (churchId ? { church_id: churchId } : {}), [churchId]);

  // ===== CARGA DE DATOS =====
  const loadGroups = useCallback(async () => {
    try {
      const { data } = await api.get('/bible-club/groups', { params });
      const list = data.groups || [];
      setGroups(list);
      // Recuerda el último salón abierto entre sesiones
      setSelectedGroup((prev) => {
        if (prev && list.some((g) => g.id === prev)) return prev;
        const saved = parseInt(readLS(LS_GROUP), 10);
        if (saved && list.some((g) => g.id === saved)) return saved;
        return list.length ? list[0].id : '';
      });
    } catch (error) {
      toast.error('Error al cargar los grupos del club');
    }
  }, [params]);

  const loadStudents = useCallback(async () => {
    if (!selectedGroup) {
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/bible-club/students', {
        params: { ...params, group_id: selectedGroup, include_inactive: showInactive },
      });
      setStudents(data.students || []);
    } catch (error) {
      toast.error('Error al cargar los participantes');
    } finally {
      setLoading(false);
    }
  }, [params, selectedGroup, showInactive]);

  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { if (selectedGroup) writeLS(LS_GROUP, String(selectedGroup)); }, [selectedGroup]);

  const currentGroup = groups.find((g) => g.id === selectedGroup) || null;

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [students, search]);

  const totals = useMemo(() => students.reduce((acc, s) => ({
    balance: acc.balance + s.balance,
    earned: acc.earned + s.earned,
    redeemed: acc.redeemed + s.redeemed,
  }), { balance: 0, earned: 0, redeemed: 0 }), [students]);

  // ===== GRUPOS =====
  const openNewGroup = () => {
    setGroupMenu(false);
    setGroupDialog({
      editing: null,
      form: { name: '', teacher: '', description: '', is_active: true, levels: DEFAULT_LEVELS },
    });
  };

  const openEditGroup = () => {
    if (!currentGroup) return;
    setGroupMenu(false);
    setGroupDialog({
      editing: currentGroup,
      form: {
        name: currentGroup.name,
        teacher: currentGroup.teacher || '',
        description: currentGroup.description || '',
        is_active: currentGroup.is_active,
        levels: currentGroup.levels || DEFAULT_LEVELS,
      },
    });
  };

  const saveGroup = async (e) => {
    e.preventDefault();
    const { editing, form } = groupDialog;
    try {
      const body = { ...form, ...(churchId ? { church_id: churchId } : {}) };
      if (editing) {
        await api.put(`/bible-club/groups/${editing.id}`, body);
        toast.success('Grupo actualizado');
      } else {
        const { data } = await api.post('/bible-club/groups', body);
        toast.success('Grupo creado');
        setSelectedGroup(data.group.id);
      }
      setGroupDialog(null);
      loadGroups();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar el grupo');
    }
  };

  const deleteGroup = async () => {
    if (!currentGroup) return;
    setGroupMenu(false);
    if (!window.confirm(`¿Eliminar el grupo "${currentGroup.name}"?`)) return;
    try {
      await api.delete(`/bible-club/groups/${currentGroup.id}`);
      toast.success('Grupo eliminado');
      setSelectedGroup('');
      loadGroups();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al eliminar el grupo');
    }
  };

  /**
   * Descarga la tabla de posiciones del salon en PDF (estilo liga de futbol).
   * El servidor la arma con los mismos datos que muestra la pantalla.
   */
  const downloadStandingsPdf = async () => {
    if (!currentGroup) return;
    setGroupMenu(false);
    setDownloadingPdf(true);
    try {
      const response = await api.get(`/bible-club/groups/${currentGroup.id}/standings.pdf`, {
        params: { ...params, include_inactive: showInactive },
        responseType: 'blob', // Importante: recibir como binario
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Tabla_Posiciones_${currentGroup.name.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Tabla de posiciones descargada');
    } catch (error) {
      toast.error('No se pudo generar el PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ===== PARTICIPANTES =====
  const openNewStudent = () => {
    setGroupMenu(false);
    setStudentDialog({
      editing: null,
      form: {
        full_name: '', group_id: selectedGroup, phone: '', notes: '',
        is_active: true, initial_points: '',
      },
    });
  };

  const openEditStudent = (student) => {
    setActionSheet(null);
    setStudentDialog({
      editing: student,
      form: {
        full_name: student.full_name,
        group_id: student.group_id,
        phone: student.phone || '',
        notes: student.notes || '',
        is_active: student.is_active,
        initial_points: '',
      },
    });
  };

  const saveStudent = async (e) => {
    e.preventDefault();
    const { editing, form } = studentDialog;
    try {
      if (editing) {
        await api.put(`/bible-club/students/${editing.id}`, form);
        toast.success('Participante actualizado');
      } else {
        await api.post('/bible-club/students', form);
        toast.success('Participante agregado');
      }
      setStudentDialog(null);
      loadStudents();
      loadGroups();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar el participante');
    }
  };

  const deleteStudent = async (student) => {
    setActionSheet(null);
    if (!window.confirm(`¿Eliminar a ${student.full_name} y todo su historial de puntos?`)) return;
    try {
      await api.delete(`/bible-club/students/${student.id}`);
      toast.success('Participante eliminado');
      loadStudents();
      loadGroups();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al eliminar');
    }
  };

  // ===== REGISTRO DE PUNTOS EN LOTE (hoja del sábado) =====
  const openPointsDialog = () => {
    setPointsSearch('');
    // Recupera una hoja a medio llenar si la app se cerró antes de guardar
    const saved = readLS(LS_DRAFT(selectedGroup));
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft && draft.values && Object.keys(draft.values).length > 0) {
          setPointsDialog(draft);
          setDraftRestored(true);
          return;
        }
      } catch { /* borrador corrupto: se ignora */ }
    }
    setDraftRestored(false);
    setPointsDialog({
      date: lastSaturday(),
      reason: 'Lista de asistencia',
      notes: '',
      values: {}, // { [student_id]: puntos }
    });
  };

  const closePointsDialog = () => {
    setPointsDialog(null);
    setDraftRestored(false);
  };

  // Guarda el borrador en cada cambio (sobrevive a recargas y cierres de la app)
  useEffect(() => {
    if (!pointsDialog || !selectedGroup) return;
    const hasValues = Object.values(pointsDialog.values).some((v) => parseInt(v, 10));
    if (hasValues) writeLS(LS_DRAFT(selectedGroup), JSON.stringify(pointsDialog));
    else removeLS(LS_DRAFT(selectedGroup));
  }, [pointsDialog, selectedGroup]);

  const setStudentPoints = (studentId, value) => {
    setPointsDialog((prev) => ({ ...prev, values: { ...prev.values, [studentId]: value } }));
  };

  const addStudentPoints = (studentId, amount) => {
    setPointsDialog((prev) => {
      const current = parseInt(prev.values[studentId], 10) || 0;
      const next = current + amount;
      return { ...prev, values: { ...prev.values, [studentId]: next === 0 ? '' : String(next) } };
    });
  };

  /**
   * Vuelca en la hoja los puntos leídos por el OCR.
   * Se suman a lo que ya estuviera escrito, no lo reemplazan, para poder
   * escanear y luego seguir ajustando a mano.
   */
  const applyScannedPoints = (scanned) => {
    setPointsDialog((prev) => {
      if (!prev) return prev;
      const values = { ...prev.values };
      for (const [studentId, points] of Object.entries(scanned)) {
        const current = parseInt(values[studentId], 10) || 0;
        values[studentId] = String(current + points);
      }
      return { ...prev, values };
    });
    toast.success(`${Object.keys(scanned).length} participante(s) cargados desde la hoja`);
  };

  const pointsSummary = useMemo(() => {
    if (!pointsDialog) return { count: 0, total: 0 };
    return Object.values(pointsDialog.values).reduce((acc, v) => {
      const n = parseInt(v, 10);
      if (!Number.isFinite(n) || n === 0) return acc;
      return { count: acc.count + 1, total: acc.total + n };
    }, { count: 0, total: 0 });
  }, [pointsDialog]);

  /** Participantes listados dentro del diálogo de puntos (con buscador) */
  const pointsStudents = useMemo(() => {
    const active = students.filter((s) => s.is_active);
    const q = pointsSearch.trim().toLowerCase();
    if (!q) return active;
    return active.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [students, pointsSearch]);

  const savePoints = async (e) => {
    e.preventDefault();
    const entries = Object.entries(pointsDialog.values)
      .map(([student_id, value]) => ({
        student_id: parseInt(student_id, 10),
        points: parseInt(value, 10),
        type: 'earn',
        reason: pointsDialog.reason,
        notes: pointsDialog.notes || null,
      }))
      .filter((entry) => Number.isFinite(entry.points) && entry.points !== 0);

    if (!entries.length) {
      toast.warn('Escribe los puntos de al menos un participante');
      return;
    }

    try {
      const { data } = await api.post('/bible-club/transactions', {
        activity_date: pointsDialog.date,
        entries,
      });
      toast.success(data.message);
      removeLS(LS_DRAFT(selectedGroup));
      closePointsDialog();
      loadStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al registrar puntos');
    }
  };

  // ===== CANJES =====
  const openRedeem = (student) => {
    setActionSheet(null);
    setRedeemDialog({
      student,
      form: { item: '', points: '', date: new Date().toISOString().split('T')[0], notes: '' },
    });
  };

  const saveRedeem = async (e) => {
    e.preventDefault();
    const { student, form } = redeemDialog;
    const points = Math.abs(parseInt(form.points, 10));

    if (!Number.isFinite(points) || points === 0) {
      toast.warn('Indica los puntos que cuesta el artículo');
      return;
    }
    if (points > student.balance
      && !window.confirm(`${student.full_name} tiene ${student.balance} puntos y el canje cuesta ${points}. ¿Registrar de todos modos?`)) {
      return;
    }

    try {
      await api.post('/bible-club/transactions', {
        activity_date: form.date,
        entries: [{
          student_id: student.id,
          points,
          type: 'redeem',
          reason: 'Canje de artículo',
          item: form.item.trim() || 'Artículo canjeado',
          notes: form.notes || null,
        }],
      });
      toast.success('Canje registrado');
      setRedeemDialog(null);
      loadStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al registrar el canje');
    }
  };

  // ===== HISTORIAL =====
  const openHistory = async (student) => {
    setActionSheet(null);
    setHistoryDialog({ student, transactions: [], loading: true });
    try {
      const { data } = await api.get(`/bible-club/students/${student.id}/transactions`);
      setHistoryDialog({ student, transactions: data.transactions || [], loading: false });
    } catch (error) {
      toast.error('Error al cargar el historial');
      setHistoryDialog(null);
    }
  };

  const deleteTransaction = async (tx) => {
    if (!window.confirm(`¿Eliminar este movimiento de ${tx.points} puntos?`)) return;
    try {
      await api.delete(`/bible-club/transactions/${tx.id}`);
      toast.success('Movimiento eliminado');
      openHistory(historyDialog.student);
      loadStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al eliminar el movimiento');
    }
  };

  // ======================================================
  // RENDER
  // ======================================================
  return (
    <Box sx={{ pb: isMobile ? `calc(88px + ${BOTTOM_SAFE})` : 0 }}>
      {backButton}

      {/* ===== CABECERA FIJA (salones + búsqueda + resumen) ===== */}
      <Paper
        elevation={0}
        sx={{
          position: 'sticky',
          top: TOP_OFFSET,
          zIndex: 3,
          p: { xs: 1.25, sm: 2 },
          mb: 1.5,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <MenuBookIcon color="primary" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant={isMobile ? 'subtitle1' : 'h5'} fontWeight={700} noWrap>
              Club Bíblico
            </Typography>
            {!isMobile && (
              <Typography variant="caption" color="text.secondary">Sección de adolescentes</Typography>
            )}
          </Box>

          {isMobile ? (
            <IconButton onClick={() => setGroupMenu(true)} aria-label="Opciones del salón">
              <MoreVertIcon />
            </IconButton>
          ) : (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" color="success" startIcon={<EmojiEventsIcon />}
                onClick={downloadStandingsPdf} disabled={!selectedGroup || downloadingPdf}>
                {downloadingPdf ? 'Generando…' : 'Tabla de posiciones'}
              </Button>
              {canCreate && (
                <Button variant="contained" startIcon={<PlaylistAddCheckIcon />}
                  onClick={openPointsDialog} disabled={!selectedGroup}>
                  Registrar puntos
                </Button>
              )}
              {canCreate && (
                <Button variant="outlined" startIcon={<AddIcon />}
                  onClick={openNewStudent} disabled={!selectedGroup}>
                  Participante
                </Button>
              )}
            </Stack>
          )}
        </Box>

        {/* Salones: chips deslizables en móvil, selector en escritorio */}
        {isMobile ? (
          <Box sx={{
            display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5, mb: 1,
            '&::-webkit-scrollbar': { display: 'none' },
          }}>
            {groups.length === 0 && (
              <Typography variant="caption" color="text.secondary">Aún no hay salones</Typography>
            )}
            {groups.map((g) => (
              <Chip
                key={g.id}
                label={`${g.name} · ${g.students_count}`}
                onClick={() => setSelectedGroup(g.id)}
                color={g.id === selectedGroup ? 'primary' : 'default'}
                variant={g.id === selectedGroup ? 'filled' : 'outlined'}
                sx={{ flexShrink: 0, height: 34, fontWeight: 700 }}
              />
            ))}
          </Box>
        ) : (
          <Grid container spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Grupo / Salón</InputLabel>
                <Select label="Grupo / Salón" value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}>
                  {groups.length === 0 && <MenuItem value="" disabled>No hay grupos</MenuItem>}
                  {groups.map((g) => (
                    <MenuItem key={g.id} value={g.id}>
                      {g.name} ({g.students_count}){!g.is_active && ' — inactivo'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={8} sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {canCreate && <Button size="small" startIcon={<GroupsIcon />} onClick={openNewGroup}>Nuevo grupo</Button>}
              {canEdit && currentGroup && <Button size="small" startIcon={<EditIcon />} onClick={openEditGroup}>Editar grupo</Button>}
              {canDelete && currentGroup && <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={deleteGroup}>Eliminar</Button>}
            </Grid>
          </Grid>
        )}

        {/* Buscador */}
        <TextField
          fullWidth size="small" placeholder="Buscar participante..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
            sx: { borderRadius: 6 },
          }}
        />

        {/* Resumen del salón */}
        {isMobile ? (
          <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 1.25, textAlign: 'center' }}>
            {[
              { label: 'Muchachos', value: students.length, color: 'text.primary' },
              { label: 'Disponibles', value: totals.balance, color: 'success.main' },
              { label: 'Ganados', value: totals.earned, color: 'primary.main' },
              { label: 'Canjeados', value: totals.redeemed, color: 'warning.main' },
            ].map((m) => (
              <Box key={m.label}>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: m.color, lineHeight: 1.2 }}>
                  {m.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">{m.label}</Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5, alignItems: 'center' }}>
            {currentGroup?.teacher && <Chip size="small" variant="outlined" label={`Maestro: ${currentGroup.teacher}`} />}
            {(currentGroup?.levels || DEFAULT_LEVELS).map((lvl) => (
              <Chip key={lvl.name} size="small" label={`${lvl.name}: ${lvl.min_points}+`}
                sx={{ bgcolor: lvl.color, color: '#fff', fontWeight: 600 }} />
            ))}
          </Box>
        )}
      </Paper>

      {/* Resumen en tarjetas (solo escritorio) */}
      {!isMobile && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[
            { label: 'Participantes', value: students.length, color: '#1E88E5' },
            { label: 'Puntos disponibles', value: totals.balance, color: '#2E7D32' },
            { label: 'Total ganado', value: totals.earned, color: '#6A1B9A' },
            { label: 'Puntos canjeados', value: totals.redeemed, color: '#EF6C00' },
          ].map((card) => (
            <Grid item xs={6} md={3} key={card.label}>
              <Paper sx={{ p: 2, borderLeft: `4px solid ${card.color}` }}>
                <Typography variant="caption" color="text.secondary">{card.label}</Typography>
                <Typography variant="h5" fontWeight={700} sx={{ color: card.color }}>{card.value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {!isMobile && (
        <Box sx={{ mb: 1 }}>
          <FormControlLabel
            control={<Switch size="small" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />}
            label={<Typography variant="body2">Mostrar participantes inactivos</Typography>}
          />
        </Box>
      )}

      {/* ===== LISTA DE SALDOS ===== */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
      ) : !selectedGroup ? (
        <Alert severity="info">
          Crea un salón (por ejemplo "Salón A") para empezar a llevar el puntaje de los muchachos.
        </Alert>
      ) : visibleStudents.length === 0 ? (
        <Alert severity="info">No hay participantes que coincidan con la búsqueda.</Alert>
      ) : isMobile ? (
        <Paper sx={{ overflow: 'hidden' }}>
          {visibleStudents.map((s, idx) => (
            <Box key={s.id}>
              {idx > 0 && <Divider />}
              <Box
                onClick={() => setActionSheet(s)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25,
                  cursor: 'pointer', opacity: s.is_active ? 1 : 0.5,
                  '&:active': { bgcolor: 'action.selected' },
                }}
              >
                {/* Posición / podio */}
                <Avatar sx={{
                  width: 30, height: 30, fontSize: 13, fontWeight: 800,
                  bgcolor: idx < 3 ? PODIUM[idx] : 'grey.200',
                  color: idx < 3 ? '#fff' : 'text.secondary',
                }}>
                  {idx + 1}
                </Avatar>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontSize={15} fontWeight={700} noWrap>{s.full_name}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                    <LevelChip level={s.level} />
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {s.items.length > 0 ? `🎁 ${s.items[0].item}` : `ganados: ${s.earned}`}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ textAlign: 'right', minWidth: 56 }}>
                  <Typography fontSize={20} fontWeight={800} color="primary.main" lineHeight={1.1}>
                    {s.balance}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">pts</Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 48 }}>#</TableCell>
                  <TableCell>Participante</TableCell>
                  <TableCell align="center">Puntos</TableCell>
                  <TableCell align="center">Total ganado</TableCell>
                  <TableCell align="center">Nivel máximo</TableCell>
                  <TableCell>Artículo canjeado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleStudents.map((s, idx) => (
                  <TableRow key={s.id} hover sx={{ opacity: s.is_active ? 1 : 0.55 }}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600} fontSize={14}>
                        {s.full_name}{!s.is_active && ' (inactivo)'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontWeight={700} color="primary">{s.balance}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" color="text.secondary">{s.earned}</Typography>
                    </TableCell>
                    <TableCell align="center"><LevelChip level={s.level} /></TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      {s.items.length === 0 ? (
                        <Typography variant="caption" color="text.secondary">-</Typography>
                      ) : (
                        <Tooltip title={s.items.map((i) => `${i.item} (${formatDate(i.date)})`).join(' · ')}>
                          <Typography variant="caption" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.items.map((i) => i.item).join(', ')}
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton size="small" onClick={() => openHistory(s)} title="Historial"><HistoryIcon fontSize="small" /></IconButton>
                      {canCreate && <IconButton size="small" color="warning" onClick={() => openRedeem(s)} title="Canjear artículo"><RedeemIcon fontSize="small" /></IconButton>}
                      {canEdit && <IconButton size="small" color="primary" onClick={() => openEditStudent(s)} title="Editar"><EditIcon fontSize="small" /></IconButton>}
                      {canDelete && <IconButton size="small" color="error" onClick={() => deleteStudent(s)} title="Eliminar"><DeleteIcon fontSize="small" /></IconButton>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ===== BOTÓN FLOTANTE (móvil) ===== */}
      {isMobile && canCreate && selectedGroup && (
        <Fab
          color="primary" variant="extended"
          onClick={openPointsDialog}
          sx={{
            position: 'fixed', right: 16, bottom: `calc(16px + ${BOTTOM_SAFE})`,
            zIndex: 1200, fontWeight: 700,
          }}
        >
          <PlaylistAddCheckIcon sx={{ mr: 1 }} />
          Puntos
        </Fab>
      )}

      {/* ===== HOJA INFERIOR: ACCIONES DEL PARTICIPANTE ===== */}
      <Drawer
        anchor="bottom" open={!!actionSheet} onClose={() => setActionSheet(null)}
        PaperProps={{ sx: { borderTopLeftRadius: 18, borderTopRightRadius: 18, pb: BOTTOM_SAFE } }}
      >
        {actionSheet && (
          <Box>
            {/* Manija visual de la hoja */}
            <Box sx={{ width: 38, height: 4, bgcolor: 'divider', borderRadius: 2, mx: 'auto', mt: 1.25 }} />
            <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
              <Typography variant="h6" fontWeight={700}>{actionSheet.full_name}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                <LevelChip level={actionSheet.level} />
                <Typography variant="body2" color="text.secondary">
                  {actionSheet.balance} pts disponibles · {actionSheet.earned} ganados
                  {actionSheet.redeemed > 0 && ` · ${actionSheet.redeemed} canjeados`}
                </Typography>
              </Box>
            </Box>
            <Divider />
            <List sx={{ py: 0 }}>
              <ListItemButton onClick={() => openHistory(actionSheet)} sx={{ py: 1.5 }}>
                <ListItemIcon><HistoryIcon /></ListItemIcon>
                <ListItemText primary="Ver historial de puntos" />
              </ListItemButton>
              {canCreate && (
                <ListItemButton onClick={() => openRedeem(actionSheet)} sx={{ py: 1.5 }}>
                  <ListItemIcon><RedeemIcon color="warning" /></ListItemIcon>
                  <ListItemText primary="Canjear artículo" />
                </ListItemButton>
              )}
              {canEdit && (
                <ListItemButton onClick={() => openEditStudent(actionSheet)} sx={{ py: 1.5 }}>
                  <ListItemIcon><EditIcon color="primary" /></ListItemIcon>
                  <ListItemText primary="Editar participante" />
                </ListItemButton>
              )}
              {canDelete && (
                <ListItemButton onClick={() => deleteStudent(actionSheet)} sx={{ py: 1.5 }}>
                  <ListItemIcon><DeleteIcon color="error" /></ListItemIcon>
                  <ListItemText primary="Eliminar" primaryTypographyProps={{ color: 'error.main' }} />
                </ListItemButton>
              )}
            </List>
          </Box>
        )}
      </Drawer>

      {/* ===== HOJA INFERIOR: OPCIONES DEL SALÓN (móvil) ===== */}
      <Drawer
        anchor="bottom" open={groupMenu} onClose={() => setGroupMenu(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 18, borderTopRightRadius: 18, pb: BOTTOM_SAFE } }}
      >
        <Box sx={{ width: 38, height: 4, bgcolor: 'divider', borderRadius: 2, mx: 'auto', mt: 1.25 }} />
        <Box sx={{ px: 2, pt: 1.5 }}>
          <Typography variant="h6" fontWeight={700}>{currentGroup?.name || 'Club Bíblico'}</Typography>
          <Typography variant="caption" color="text.secondary">
            {currentGroup?.teacher ? `Maestro: ${currentGroup.teacher}` : 'Sección de adolescentes'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
            {(currentGroup?.levels || DEFAULT_LEVELS).map((lvl) => (
              <Chip key={lvl.name} size="small" label={`${lvl.name}: ${lvl.min_points}+`}
                sx={{ bgcolor: lvl.color, color: '#fff', fontWeight: 600 }} />
            ))}
          </Box>
        </Box>
        <List sx={{ mt: 1 }}>
          <ListItemButton onClick={downloadStandingsPdf} disabled={!selectedGroup || downloadingPdf} sx={{ py: 1.5 }}>
            <ListItemIcon><PictureAsPdfIcon color="success" /></ListItemIcon>
            <ListItemText
              primary={downloadingPdf ? 'Generando PDF…' : 'Imprimir tabla de posiciones'}
              secondary="Podio y ranking del salón, listo para presentar"
            />
          </ListItemButton>
          {canCreate && (
            <ListItemButton onClick={openNewStudent} disabled={!selectedGroup} sx={{ py: 1.5 }}>
              <ListItemIcon><AddIcon /></ListItemIcon>
              <ListItemText primary="Agregar participante" />
            </ListItemButton>
          )}
          {canCreate && (
            <ListItemButton onClick={openNewGroup} sx={{ py: 1.5 }}>
              <ListItemIcon><GroupsIcon /></ListItemIcon>
              <ListItemText primary="Nuevo salón" />
            </ListItemButton>
          )}
          {canEdit && currentGroup && (
            <ListItemButton onClick={openEditGroup} sx={{ py: 1.5 }}>
              <ListItemIcon><EditIcon /></ListItemIcon>
              <ListItemText primary="Editar salón y niveles" />
            </ListItemButton>
          )}
          <ListItemButton onClick={() => { setShowInactive((v) => !v); setGroupMenu(false); }} sx={{ py: 1.5 }}>
            <ListItemIcon><GroupsIcon /></ListItemIcon>
            <ListItemText primary={showInactive ? 'Ocultar inactivos' : 'Mostrar inactivos'} />
          </ListItemButton>
          {canDelete && currentGroup && (
            <ListItemButton onClick={deleteGroup} sx={{ py: 1.5 }}>
              <ListItemIcon><DeleteIcon color="error" /></ListItemIcon>
              <ListItemText primary="Eliminar salón" primaryTypographyProps={{ color: 'error.main' }} />
            </ListItemButton>
          )}
        </List>
      </Drawer>

      {/* ===== DIÁLOGO: REGISTRAR PUNTOS ===== */}
      <Dialog open={!!pointsDialog} onClose={closePointsDialog} maxWidth="sm" fullWidth fullScreen={isMobile}>
        {pointsDialog && (
          <form onSubmit={savePoints} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
            {isMobile ? (
              <SheetHeader
                title="Registrar puntos"
                subtitle={currentGroup?.name}
                onClose={closePointsDialog}
                action={(
                  <>
                    <IconButton onClick={() => setScanOpen(true)} aria-label="Escanear hoja" color="primary">
                      <DocumentScannerIcon />
                    </IconButton>
                    <Button type="submit" variant="contained" size="small">Guardar</Button>
                  </>
                )}
              />
            ) : (
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <span>Registrar puntos — {currentGroup?.name}</span>
                <Button size="small" startIcon={<DocumentScannerIcon />} onClick={() => setScanOpen(true)}>
                  Escanear hoja
                </Button>
              </DialogTitle>
            )}

            <DialogContent dividers sx={{ p: { xs: 1.5, sm: 3 } }}>
              {draftRestored && (
                <Alert severity="warning" sx={{ mb: 1.5 }} onClose={() => setDraftRestored(false)}>
                  Recuperamos la hoja que dejaste sin guardar.
                </Alert>
              )}

              <Grid container spacing={1.5} sx={{ mb: 1 }}>
                <Grid item xs={6}>
                  <TextField fullWidth required size="small" type="date" label="Fecha"
                    InputLabelProps={{ shrink: true }} value={pointsDialog.date}
                    onChange={(e) => setPointsDialog({ ...pointsDialog, date: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Motivo</InputLabel>
                    <Select label="Motivo" value={pointsDialog.reason}
                      onChange={(e) => setPointsDialog({ ...pointsDialog, reason: e.target.value })}>
                      {POINT_REASONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Nota para todos (opcional)"
                    placeholder='Ej: desglose "10+10+5+100"'
                    value={pointsDialog.notes}
                    onChange={(e) => setPointsDialog({ ...pointsDialog, notes: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" placeholder="Buscar en la lista..."
                    value={pointsSearch} onChange={(e) => setPointsSearch(e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                      endAdornment: pointsSearch ? (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setPointsSearch('')}><ClearIcon fontSize="small" /></IconButton>
                        </InputAdornment>
                      ) : null,
                      sx: { borderRadius: 6 },
                    }} />
                </Grid>
              </Grid>

              <Typography variant="caption" color="text.secondary">
                Toca los atajos o escribe el total. Los que queden en blanco no se registran.
              </Typography>

              <Box sx={{ mt: 1 }}>
                {pointsStudents.map((s) => {
                  const value = pointsDialog.values[s.id] || '';
                  const active = !!parseInt(value, 10);
                  return (
                    <Box key={s.id} sx={{
                      py: 1, borderBottom: '1px solid', borderColor: 'divider',
                      bgcolor: active ? 'action.hover' : 'transparent',
                      borderRadius: active ? 1 : 0, px: active ? 0.75 : 0,
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontSize={14} fontWeight={700} noWrap>{s.full_name}</Typography>
                          <Typography variant="caption" color="text.secondary">saldo: {s.balance}</Typography>
                        </Box>
                        {/* Stepper: menos / total / más */}
                        <IconButton size="small" onClick={() => addStudentPoints(s.id, -5)}
                          disabled={!active} aria-label="Restar 5">
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                        <TextField
                          size="small" type="number" inputMode="numeric"
                          sx={{ width: 74 }}
                          inputProps={{ style: { textAlign: 'center', fontWeight: 700, padding: '8px 4px' } }}
                          value={value}
                          onChange={(e) => setStudentPoints(s.id, e.target.value)}
                        />
                        <IconButton size="small" color="primary" onClick={() => addStudentPoints(s.id, 5)}
                          aria-label="Sumar 5">
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Box sx={{
                        display: 'flex', gap: 0.5, mt: 0.75, overflowX: 'auto',
                        '&::-webkit-scrollbar': { display: 'none' },
                      }}>
                        {QUICK_POINTS.map((q) => (
                          <Chip key={q} label={`+${q}`} size="small" variant="outlined"
                            onClick={() => addStudentPoints(s.id, q)}
                            sx={{ flexShrink: 0, cursor: 'pointer', height: 28, fontWeight: 700 }} />
                        ))}
                        {active && (
                          <Chip label="Limpiar" size="small" color="default"
                            onClick={() => setStudentPoints(s.id, '')}
                            sx={{ flexShrink: 0, cursor: 'pointer', height: 28 }} />
                        )}
                      </Box>
                    </Box>
                  );
                })}
                {pointsStudents.length === 0 && (
                  <Alert severity="info" sx={{ mt: 1 }}>Nadie coincide con la búsqueda.</Alert>
                )}
              </Box>
            </DialogContent>

            {/* Barra fija con el total en vivo */}
            <DialogActions sx={{
              px: 2, py: 1.5, justifyContent: 'space-between',
              borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
            }}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {pointsSummary.total} pts
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {pointsSummary.count} participante(s)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {!isMobile && <Button onClick={closePointsDialog}>Cancelar</Button>}
                <Button variant="contained" type="submit" disabled={pointsSummary.count === 0}>
                  Registrar
                </Button>
              </Box>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* ===== DIÁLOGO: ESCANEAR LA HOJA (OCR en el propio teléfono) ===== */}
      <ScanSheetDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        students={students.filter((s) => s.is_active)}
        onApply={applyScannedPoints}
      />

      {/* ===== DIÁLOGO: CANJE ===== */}
      <Dialog open={!!redeemDialog} onClose={() => setRedeemDialog(null)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        {redeemDialog && (
          <form onSubmit={saveRedeem}>
            {isMobile ? (
              <SheetHeader title="Canjear artículo" subtitle={redeemDialog.student.full_name}
                onClose={() => setRedeemDialog(null)}
                action={<Button type="submit" variant="contained" color="warning" size="small">Guardar</Button>} />
            ) : (
              <DialogTitle>Canjear artículo</DialogTitle>
            )}
            <DialogContent dividers>
              <Alert severity="info" sx={{ mb: 2 }}>
                {redeemDialog.student.full_name} tiene <strong>{redeemDialog.student.balance}</strong> puntos disponibles.
                El canje descuenta del saldo pero no baja el nivel alcanzado.
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth required size="small" label="Artículo canjeado"
                    placeholder="Ej: audífonos, Biblia de estudio"
                    value={redeemDialog.form.item}
                    onChange={(e) => setRedeemDialog({ ...redeemDialog, form: { ...redeemDialog.form, item: e.target.value } })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth required size="small" type="number" inputMode="numeric" label="Puntos"
                    inputProps={{ min: 1 }}
                    value={redeemDialog.form.points}
                    onChange={(e) => setRedeemDialog({ ...redeemDialog, form: { ...redeemDialog.form, points: e.target.value } })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth required size="small" type="date" label="Fecha de entrega"
                    InputLabelProps={{ shrink: true }}
                    value={redeemDialog.form.date}
                    onChange={(e) => setRedeemDialog({ ...redeemDialog, form: { ...redeemDialog.form, date: e.target.value } })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Notas (opcional)" multiline rows={2}
                    value={redeemDialog.form.notes}
                    onChange={(e) => setRedeemDialog({ ...redeemDialog, form: { ...redeemDialog.form, notes: e.target.value } })} />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setRedeemDialog(null)}>Cancelar</Button>
              <Button variant="contained" color="warning" type="submit">Registrar canje</Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* ===== DIÁLOGO: PARTICIPANTE ===== */}
      <Dialog open={!!studentDialog} onClose={() => setStudentDialog(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        {studentDialog && (
          <form onSubmit={saveStudent}>
            {isMobile ? (
              <SheetHeader
                title={studentDialog.editing ? 'Editar participante' : 'Nuevo participante'}
                subtitle={currentGroup?.name}
                onClose={() => setStudentDialog(null)}
                action={<Button type="submit" variant="contained" size="small">Guardar</Button>} />
            ) : (
              <DialogTitle>{studentDialog.editing ? 'Editar participante' : 'Nuevo participante'}</DialogTitle>
            )}
            <DialogContent dividers>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={7}>
                  <TextField fullWidth required size="small" label="Nombre completo"
                    autoComplete="name"
                    value={studentDialog.form.full_name}
                    onChange={(e) => setStudentDialog({ ...studentDialog, form: { ...studentDialog.form, full_name: e.target.value } })} />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Salón</InputLabel>
                    <Select label="Salón" value={studentDialog.form.group_id}
                      onChange={(e) => setStudentDialog({ ...studentDialog, form: { ...studentDialog.form, group_id: e.target.value } })}>
                      {groups.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Teléfono (opcional)"
                    type="tel" inputMode="tel" autoComplete="tel"
                    value={studentDialog.form.phone}
                    onChange={(e) => setStudentDialog({ ...studentDialog, form: { ...studentDialog.form, phone: e.target.value } })} />
                </Grid>
                {!studentDialog.editing && (
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" type="number" inputMode="numeric" label="Puntos que ya traía"
                      helperText="Opcional: queda como movimiento 'Saldo inicial'"
                      value={studentDialog.form.initial_points}
                      onChange={(e) => setStudentDialog({ ...studentDialog, form: { ...studentDialog.form, initial_points: e.target.value } })} />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Notas (opcional)" multiline rows={2}
                    value={studentDialog.form.notes}
                    onChange={(e) => setStudentDialog({ ...studentDialog, form: { ...studentDialog.form, notes: e.target.value } })} />
                </Grid>
                {studentDialog.editing && (
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={<Switch checked={studentDialog.form.is_active}
                        onChange={(e) => setStudentDialog({ ...studentDialog, form: { ...studentDialog.form, is_active: e.target.checked } })} />}
                      label={studentDialog.form.is_active ? 'Activo' : 'Inactivo (ya no asiste)'}
                    />
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setStudentDialog(null)}>Cancelar</Button>
              <Button variant="contained" type="submit">{studentDialog.editing ? 'Actualizar' : 'Agregar'}</Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* ===== DIÁLOGO: SALÓN (con editor de niveles) ===== */}
      <Dialog open={!!groupDialog} onClose={() => setGroupDialog(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        {groupDialog && (
          <form onSubmit={saveGroup}>
            {isMobile ? (
              <SheetHeader
                title={groupDialog.editing ? 'Editar salón' : 'Nuevo salón'}
                onClose={() => setGroupDialog(null)}
                action={<Button type="submit" variant="contained" size="small">Guardar</Button>} />
            ) : (
              <DialogTitle>{groupDialog.editing ? 'Editar grupo' : 'Nuevo grupo / salón'}</DialogTitle>
            )}
            <DialogContent dividers>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required size="small" label="Nombre del salón" placeholder="Ej: Salón A"
                    value={groupDialog.form.name}
                    onChange={(e) => setGroupDialog({ ...groupDialog, form: { ...groupDialog.form, name: e.target.value } })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Maestro / responsable"
                    value={groupDialog.form.teacher}
                    onChange={(e) => setGroupDialog({ ...groupDialog, form: { ...groupDialog.form, teacher: e.target.value } })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Descripción (opcional)" multiline rows={2}
                    value={groupDialog.form.description}
                    onChange={(e) => setGroupDialog({ ...groupDialog, form: { ...groupDialog.form, description: e.target.value } })} />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Niveles de premiación</Typography>
              <Typography variant="caption" color="text.secondary">
                El nivel se alcanza con el total de puntos ganados (no baja al canjear).
              </Typography>

              <Box sx={{ mt: 1.5 }}>
                {groupDialog.form.levels.map((lvl, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                    <TextField size="small" label="Nivel" value={lvl.name} sx={{ flex: 1 }}
                      onChange={(e) => {
                        const levels = [...groupDialog.form.levels];
                        levels[i] = { ...levels[i], name: e.target.value };
                        setGroupDialog({ ...groupDialog, form: { ...groupDialog.form, levels } });
                      }} />
                    <TextField size="small" label="Desde" type="number" inputMode="numeric" sx={{ width: 100 }} value={lvl.min_points}
                      onChange={(e) => {
                        const levels = [...groupDialog.form.levels];
                        levels[i] = { ...levels[i], min_points: e.target.value };
                        setGroupDialog({ ...groupDialog, form: { ...groupDialog.form, levels } });
                      }} />
                    <TextField size="small" type="color" sx={{ width: 62 }} value={lvl.color}
                      onChange={(e) => {
                        const levels = [...groupDialog.form.levels];
                        levels[i] = { ...levels[i], color: e.target.value };
                        setGroupDialog({ ...groupDialog, form: { ...groupDialog.form, levels } });
                      }} />
                    <IconButton size="small" color="error" onClick={() => {
                      const levels = groupDialog.form.levels.filter((_, j) => j !== i);
                      setGroupDialog({ ...groupDialog, form: { ...groupDialog.form, levels } });
                    }}><DeleteIcon fontSize="small" /></IconButton>
                  </Box>
                ))}
                <Button size="small" startIcon={<AddIcon />} onClick={() => setGroupDialog({
                  ...groupDialog,
                  form: {
                    ...groupDialog.form,
                    levels: [...groupDialog.form.levels, { name: '', min_points: 0, color: '#90A4AE' }],
                  },
                })}>Agregar nivel</Button>
              </Box>

              {groupDialog.editing && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <FormControlLabel
                    control={<Switch checked={groupDialog.form.is_active}
                      onChange={(e) => setGroupDialog({ ...groupDialog, form: { ...groupDialog.form, is_active: e.target.checked } })} />}
                    label={groupDialog.form.is_active ? 'Salón activo' : 'Salón inactivo'}
                  />
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setGroupDialog(null)}>Cancelar</Button>
              <Button variant="contained" type="submit">{groupDialog.editing ? 'Actualizar' : 'Crear salón'}</Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* ===== DIÁLOGO: HISTORIAL ===== */}
      <Dialog open={!!historyDialog} onClose={() => setHistoryDialog(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        {historyDialog && (
          <>
            {isMobile ? (
              <SheetHeader
                title="Historial"
                subtitle={`${historyDialog.student.full_name} · ${historyDialog.student.balance} pts`}
                onClose={() => setHistoryDialog(null)} />
            ) : (
              <DialogTitle>Historial — {historyDialog.student.full_name}</DialogTitle>
            )}
            <DialogContent dividers sx={{ p: { xs: 1, sm: 3 } }}>
              {historyDialog.loading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
              ) : historyDialog.transactions.length === 0 ? (
                <Alert severity="info">Este participante todavía no tiene movimientos.</Alert>
              ) : isMobile ? (
                <Box>
                  {historyDialog.transactions.map((tx) => (
                    <Box key={tx.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 1, py: 1.25,
                      borderBottom: '1px solid', borderColor: 'divider',
                    }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontSize={14} fontWeight={700} noWrap>
                          {tx.item || tx.reason || TYPE_LABELS[tx.type]}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {formatDate(tx.activity_date)}{tx.notes ? ` · ${tx.notes}` : ''}
                        </Typography>
                      </Box>
                      <Typography fontWeight={800} fontSize={16}
                        color={tx.points < 0 ? 'error.main' : 'success.main'}>
                        {tx.points > 0 ? `+${tx.points}` : tx.points}
                      </Typography>
                      {canDelete && (
                        <IconButton size="small" color="error" onClick={() => deleteTransaction(tx)} aria-label="Eliminar">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Movimiento</TableCell>
                        <TableCell align="center">Puntos</TableCell>
                        {canDelete && <TableCell align="right" />}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {historyDialog.transactions.map((tx) => (
                        <TableRow key={tx.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(tx.activity_date)}</TableCell>
                          <TableCell>
                            <Typography fontSize={13} fontWeight={600}>
                              {tx.item || tx.reason || TYPE_LABELS[tx.type]}
                            </Typography>
                            {tx.notes && <Typography variant="caption" color="text.secondary">{tx.notes}</Typography>}
                          </TableCell>
                          <TableCell align="center">
                            <Typography fontWeight={700} color={tx.points < 0 ? 'error.main' : 'success.main'}>
                              {tx.points > 0 ? `+${tx.points}` : tx.points}
                            </Typography>
                          </TableCell>
                          {canDelete && (
                            <TableCell align="right">
                              <IconButton size="small" color="error" onClick={() => deleteTransaction(tx)} title="Eliminar">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DialogContent>
            {!isMobile && (
              <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={() => setHistoryDialog(null)}>Cerrar</Button>
              </DialogActions>
            )}
          </>
        )}
      </Dialog>
    </Box>
  );
};

// ========================================================
// COMPONENTE PRINCIPAL: SuperAdmin elige iglesia primero
// ========================================================
const BibleClub = () => (
  <ChurchSelector title="Club Bíblico">
    {({ churchId, churchName, backButton }) => (
      <BibleClubContent churchId={churchId} churchName={churchName} backButton={backButton} />
    )}
  </ChurchSelector>
);

export default BibleClub;

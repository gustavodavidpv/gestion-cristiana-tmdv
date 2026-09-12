/**
 * BibleClub.js - Club Bíblico (sección de adolescentes)
 *
 * Funcionalidades:
 * - Grupos/salones (ej: "Salón A") con niveles de premiación configurables
 * - Tabla de saldos por participante (saldo, total ganado, nivel máximo, canjes)
 * - Registro de puntos en lote, igual que la hoja de asistencia del sábado
 * - Canje de artículos (descuenta del saldo y queda en el historial)
 * - Historial completo de movimientos por participante
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
import {
  Box, Paper, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  CircularProgress, Switch, FormControlLabel, Divider, Alert, Tooltip,
  InputAdornment, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  MenuBook as MenuBookIcon, EmojiEvents as EmojiEventsIcon,
  Redeem as RedeemIcon, History as HistoryIcon, Search as SearchIcon,
  PlaylistAddCheck as PlaylistAddCheckIcon, Groups as GroupsIcon,
} from '@mui/icons-material';

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

/** Chip de nivel con el color configurado en el grupo */
const LevelChip = ({ level }) => {
  if (!level) return <Chip label="-" size="small" variant="outlined" />;
  return (
    <Chip
      label={level.name}
      size="small"
      sx={{
        bgcolor: level.color,
        color: '#fff',
        fontWeight: 700,
        '& .MuiChip-label': { px: 1.2 },
      }}
    />
  );
};

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

  // Dialogs
  const [groupDialog, setGroupDialog] = useState(null);   // { editing, form }
  const [studentDialog, setStudentDialog] = useState(null); // { editing, form }
  const [pointsDialog, setPointsDialog] = useState(null);   // { date, reason, notes, values }
  const [redeemDialog, setRedeemDialog] = useState(null);   // { student, form }
  const [historyDialog, setHistoryDialog] = useState(null); // { student, transactions, loading }

  const params = useMemo(() => (churchId ? { church_id: churchId } : {}), [churchId]);

  // ===== CARGA DE DATOS =====
  const loadGroups = useCallback(async () => {
    try {
      const { data } = await api.get('/bible-club/groups', { params });
      setGroups(data.groups || []);
      // Seleccionar el primer grupo automáticamente
      setSelectedGroup((prev) => {
        if (prev && data.groups.some((g) => g.id === prev)) return prev;
        return data.groups.length ? data.groups[0].id : '';
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

  const currentGroup = groups.find((g) => g.id === selectedGroup) || null;

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [students, search]);

  // Totales del grupo para las tarjetas de resumen
  const totals = useMemo(() => students.reduce((acc, s) => ({
    balance: acc.balance + s.balance,
    earned: acc.earned + s.earned,
    redeemed: acc.redeemed + s.redeemed,
  }), { balance: 0, earned: 0, redeemed: 0 }), [students]);

  // ===== GRUPOS =====
  const openNewGroup = () => setGroupDialog({
    editing: null,
    form: { name: '', teacher: '', description: '', is_active: true, levels: DEFAULT_LEVELS },
  });

  const openEditGroup = () => {
    if (!currentGroup) return;
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

  // ===== PARTICIPANTES =====
  const openNewStudent = () => setStudentDialog({
    editing: null,
    form: {
      full_name: '', group_id: selectedGroup, phone: '', notes: '',
      is_active: true, initial_points: '',
    },
  });

  const openEditStudent = (student) => setStudentDialog({
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
  const openPointsDialog = () => setPointsDialog({
    date: lastSaturday(),
    reason: 'Lista de asistencia',
    notes: '',
    values: {}, // { [student_id]: puntos }
  });

  const setStudentPoints = (studentId, value) => {
    setPointsDialog((prev) => ({ ...prev, values: { ...prev.values, [studentId]: value } }));
  };

  const addStudentPoints = (studentId, amount) => {
    setPointsDialog((prev) => {
      const current = parseInt(prev.values[studentId], 10) || 0;
      return { ...prev, values: { ...prev.values, [studentId]: String(current + amount) } };
    });
  };

  const pointsSummary = useMemo(() => {
    if (!pointsDialog) return { count: 0, total: 0 };
    return Object.values(pointsDialog.values).reduce((acc, v) => {
      const n = parseInt(v, 10);
      if (!Number.isFinite(n) || n === 0) return acc;
      return { count: acc.count + 1, total: acc.total + n };
    }, { count: 0, total: 0 });
  }, [pointsDialog]);

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
      .filter((e2) => Number.isFinite(e2.points) && e2.points !== 0);

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
      setPointsDialog(null);
      loadStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al registrar puntos');
    }
  };

  // ===== CANJES =====
  const openRedeem = (student) => setRedeemDialog({
    student,
    form: { item: '', points: '', date: new Date().toISOString().split('T')[0], notes: '' },
  });

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

  // ===== RENDER =====
  return (
    <Box>
      {backButton}

      {/* Encabezado */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MenuBookIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Club Bíblico</Typography>
            <Typography variant="caption" color="text.secondary">Sección de adolescentes</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
        </Box>
      </Box>

      {/* Selector de grupo + acciones del grupo */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Grupo / Salón</InputLabel>
              <Select
                label="Grupo / Salón"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                {groups.length === 0 && <MenuItem value="" disabled>No hay grupos</MenuItem>}
                {groups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.name} ({g.students_count}){!g.is_active && ' — inactivo'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth size="small" placeholder="Buscar participante..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} sm={4} sx={{ display: 'flex', gap: 1, justifyContent: { sm: 'flex-end' }, flexWrap: 'wrap' }}>
            {canCreate && (
              <Button size="small" startIcon={<GroupsIcon />} onClick={openNewGroup}>Nuevo grupo</Button>
            )}
            {canEdit && currentGroup && (
              <Button size="small" startIcon={<EditIcon />} onClick={openEditGroup}>Editar grupo</Button>
            )}
            {canDelete && currentGroup && (
              <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={deleteGroup}>Eliminar</Button>
            )}
          </Grid>
        </Grid>

        {currentGroup && (
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {currentGroup.teacher && (
              <Chip size="small" variant="outlined" label={`Maestro: ${currentGroup.teacher}`} />
            )}
            {(currentGroup.levels || DEFAULT_LEVELS).map((lvl) => (
              <Chip key={lvl.name} size="small" label={`${lvl.name}: ${lvl.min_points}+`}
                sx={{ bgcolor: lvl.color, color: '#fff', fontWeight: 600 }} />
            ))}
          </Box>
        )}
      </Paper>

      {/* Resumen del grupo */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Participantes', value: students.length, color: '#1E88E5', icon: <GroupsIcon /> },
          { label: 'Puntos disponibles', value: totals.balance, color: '#2E7D32', icon: <EmojiEventsIcon /> },
          { label: 'Total ganado', value: totals.earned, color: '#6A1B9A', icon: <EmojiEventsIcon /> },
          { label: 'Puntos canjeados', value: totals.redeemed, color: '#EF6C00', icon: <RedeemIcon /> },
        ].map((card) => (
          <Grid item xs={6} md={3} key={card.label}>
            <Paper sx={{ p: 2, borderLeft: `4px solid ${card.color}` }}>
              <Typography variant="caption" color="text.secondary">{card.label}</Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: card.color }}>{card.value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mb: 1 }}>
        <FormControlLabel
          control={<Switch size="small" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />}
          label={<Typography variant="body2">Mostrar participantes inactivos</Typography>}
        />
      </Box>

      {/* Tabla / cards de saldos */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
      ) : !selectedGroup ? (
        <Alert severity="info">
          Crea un grupo (por ejemplo "Salón A") para empezar a llevar el puntaje de los muchachos.
        </Alert>
      ) : visibleStudents.length === 0 ? (
        <Alert severity="info">No hay participantes que coincidan con la búsqueda.</Alert>
      ) : isMobile ? (
        <Box>
          {visibleStudents.map((s, idx) => (
            <Paper key={s.id} sx={{ p: 2, mb: 1.5, borderLeft: `4px solid ${s.level?.color || '#90A4AE'}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={700} fontSize={14}>
                    {idx + 1}. {s.full_name}{!s.is_active && ' (inactivo)'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    <LevelChip level={s.level} />
                    {s.redemptions > 0 && (
                      <Chip size="small" variant="outlined" icon={<RedeemIcon />} label={`${s.redemptions} canje(s)`} />
                    )}
                  </Box>
                  {s.items.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Canjeado: {s.items.map((i) => i.item).join(', ')}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" fontWeight={700} color="primary">{s.balance}</Typography>
                  <Typography variant="caption" color="text.secondary">ganados: {s.earned}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 1, justifyContent: 'flex-end' }}>
                <IconButton size="small" onClick={() => openHistory(s)} title="Historial"><HistoryIcon fontSize="small" /></IconButton>
                {canCreate && <IconButton size="small" color="warning" onClick={() => openRedeem(s)} title="Canjear"><RedeemIcon fontSize="small" /></IconButton>}
                {canEdit && <IconButton size="small" color="primary" onClick={() => openEditStudent(s)} title="Editar"><EditIcon fontSize="small" /></IconButton>}
                {canDelete && <IconButton size="small" color="error" onClick={() => deleteStudent(s)} title="Eliminar"><DeleteIcon fontSize="small" /></IconButton>}
              </Box>
            </Paper>
          ))}
        </Box>
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

      {/* ===== DIALOG: REGISTRAR PUNTOS EN LOTE ===== */}
      <Dialog open={!!pointsDialog} onClose={() => setPointsDialog(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        {pointsDialog && (
          <form onSubmit={savePoints}>
            <DialogTitle>Registrar puntos — {currentGroup?.name}</DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2} sx={{ mb: 1 }}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required size="small" type="date" label="Fecha de la clase"
                    InputLabelProps={{ shrink: true }} value={pointsDialog.date}
                    onChange={(e) => setPointsDialog({ ...pointsDialog, date: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
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
              </Grid>

              <Alert severity="info" sx={{ mb: 1.5 }}>
                Escribe los puntos de cada participante o usa los atajos. Los que queden vacíos no se registran.
              </Alert>

              <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
                {students.filter((s) => s.is_active).map((s) => (
                  <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid #eee' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontSize={14} fontWeight={600} noWrap>{s.full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">saldo: {s.balance}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      {QUICK_POINTS.map((q) => (
                        <Chip key={q} label={`+${q}`} size="small" variant="outlined"
                          onClick={() => addStudentPoints(s.id, q)} sx={{ cursor: 'pointer' }} />
                      ))}
                    </Box>
                    <TextField size="small" type="number" sx={{ width: 90 }}
                      value={pointsDialog.values[s.id] || ''}
                      onChange={(e) => setStudentPoints(s.id, e.target.value)} />
                  </Box>
                ))}
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                {pointsSummary.count} participante(s) · {pointsSummary.total} puntos
              </Typography>
              <Box>
                <Button onClick={() => setPointsDialog(null)}>Cancelar</Button>
                <Button variant="contained" type="submit">Registrar</Button>
              </Box>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* ===== DIALOG: CANJE ===== */}
      <Dialog open={!!redeemDialog} onClose={() => setRedeemDialog(null)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        {redeemDialog && (
          <form onSubmit={saveRedeem}>
            <DialogTitle>Canjear artículo</DialogTitle>
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
                  <TextField fullWidth required size="small" type="number" label="Puntos"
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

      {/* ===== DIALOG: PARTICIPANTE ===== */}
      <Dialog open={!!studentDialog} onClose={() => setStudentDialog(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        {studentDialog && (
          <form onSubmit={saveStudent}>
            <DialogTitle>{studentDialog.editing ? 'Editar participante' : 'Nuevo participante'}</DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={7}>
                  <TextField fullWidth required size="small" label="Nombre completo"
                    value={studentDialog.form.full_name}
                    onChange={(e) => setStudentDialog({ ...studentDialog, form: { ...studentDialog.form, full_name: e.target.value } })} />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Grupo</InputLabel>
                    <Select label="Grupo" value={studentDialog.form.group_id}
                      onChange={(e) => setStudentDialog({ ...studentDialog, form: { ...studentDialog.form, group_id: e.target.value } })}>
                      {groups.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Teléfono (opcional)"
                    value={studentDialog.form.phone}
                    onChange={(e) => setStudentDialog({ ...studentDialog, form: { ...studentDialog.form, phone: e.target.value } })} />
                </Grid>
                {!studentDialog.editing && (
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" type="number" label="Puntos que ya traía"
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

      {/* ===== DIALOG: GRUPO (con editor de niveles) ===== */}
      <Dialog open={!!groupDialog} onClose={() => setGroupDialog(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        {groupDialog && (
          <form onSubmit={saveGroup}>
            <DialogTitle>{groupDialog.editing ? 'Editar grupo' : 'Nuevo grupo / salón'}</DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required size="small" label="Nombre del grupo" placeholder="Ej: Salón A"
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
                    <TextField size="small" label="Desde" type="number" sx={{ width: 110 }} value={lvl.min_points}
                      onChange={(e) => {
                        const levels = [...groupDialog.form.levels];
                        levels[i] = { ...levels[i], min_points: e.target.value };
                        setGroupDialog({ ...groupDialog, form: { ...groupDialog.form, levels } });
                      }} />
                    <TextField size="small" type="color" sx={{ width: 70 }} value={lvl.color}
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
                    label={groupDialog.form.is_active ? 'Grupo activo' : 'Grupo inactivo'}
                  />
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setGroupDialog(null)}>Cancelar</Button>
              <Button variant="contained" type="submit">{groupDialog.editing ? 'Actualizar' : 'Crear grupo'}</Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* ===== DIALOG: HISTORIAL ===== */}
      <Dialog open={!!historyDialog} onClose={() => setHistoryDialog(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        {historyDialog && (
          <>
            <DialogTitle>Historial — {historyDialog.student.full_name}</DialogTitle>
            <DialogContent dividers>
              {historyDialog.loading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
              ) : historyDialog.transactions.length === 0 ? (
                <Alert severity="info">Este participante todavía no tiene movimientos.</Alert>
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
                            {tx.notes && (
                              <Typography variant="caption" color="text.secondary">{tx.notes}</Typography>
                            )}
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
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setHistoryDialog(null)}>Cerrar</Button>
            </DialogActions>
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

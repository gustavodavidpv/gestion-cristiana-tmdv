/**
 * WeeklyAttendance.js - Registro de asistencia semanal con MUI
 *
 * Funcionalidades:
 * - Tabla de registros semanales con paginación
 * - Formulario para registrar asistencia de una semana
 * - Muestra el promedio actual (calculado automáticamente)
 * - Filtro por año
 * - Editar y eliminar registros existentes
 *
 * PATRÓN SUPERADMIN:
 * - SuperAdmin ve primero la lista de iglesias (ChurchSelector)
 * - Al seleccionar una iglesia, ve los registros de esa iglesia
 * - Otros roles ven directamente los registros de su iglesia
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import ChurchSelector from '../components/layout/ChurchSelector';
import {
  Box, Paper, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, CircularProgress, TablePagination, Chip, Alert, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon, Groups as GroupsIcon,
} from '@mui/icons-material';

// ========================================================
// CONTENIDO PRINCIPAL: Tabla de asistencia semanal
// Recibe churchId y churchName del ChurchSelector
// ========================================================
const WeeklyAttendanceContent = ({ churchId, churchName, backButton }) => {
  const { hasPermission } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [records, setRecords] = useState([]);
  const [avgAttendance, setAvgAttendance] = useState(0);
  const [pagination, setPagination] = useState({ page: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // Modal crear/editar
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    week_date: '', attendance_count: '', notes: '',
  });

  // Años disponibles para el filtro (últimos 5 años)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // ===== CARGA DE REGISTROS =====
  const loadRecords = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const params = { page: page + 1, limit: 52 };
      if (filterYear) params.year = filterYear;
      // SuperAdmin: pasar church_id para consultar iglesia seleccionada
      if (churchId) params.church_id = churchId;

      const { data } = await api.get('/weekly-attendance', { params });
      setRecords(data.records);
      setAvgAttendance(data.avg_weekly_attendance);
      setPagination({ page, total: data.pagination.total });
    } catch (error) {
      toast.error('Error al cargar registros de asistencia');
    } finally {
      setLoading(false);
    }
  }, [filterYear, churchId]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // ===== CREAR / EDITAR =====
  const openNew = () => {
    setEditing(null);
    // Pre-llenar con la fecha del domingo más reciente
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Dom, 1=Lun, etc.
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - dayOfWeek);
    const dateStr = lastSunday.toISOString().split('T')[0];

    setForm({ week_date: dateStr, attendance_count: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      week_date: record.week_date,
      attendance_count: record.attendance_count,
      notes: record.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // SuperAdmin: incluir church_id en el body al crear
      const body = { ...form };
      if (churchId && !editing) body.church_id = churchId;

      if (editing) {
        const { data } = await api.put(`/weekly-attendance/${editing.id}`, body);
        toast.success('Registro actualizado');
        setAvgAttendance(data.avg_weekly_attendance);
      } else {
        const { data } = await api.post('/weekly-attendance', body);
        toast.success('Asistencia registrada');
        setAvgAttendance(data.avg_weekly_attendance);
      }
      setShowModal(false);
      loadRecords(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este registro de asistencia?')) return;
    try {
      const { data } = await api.delete(`/weekly-attendance/${id}`);
      toast.success('Registro eliminado');
      setAvgAttendance(data.avg_weekly_attendance);
      loadRecords(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al eliminar');
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  // Calcular estadísticas rápidas del año filtrado
  const yearRecords = records;
  const maxAttendance = yearRecords.length ? Math.max(...yearRecords.map((r) => r.attendance_count)) : 0;
  const minAttendance = yearRecords.length ? Math.min(...yearRecords.map((r) => r.attendance_count)) : 0;

  return (
    <Box>
      {/* Botón volver (solo SuperAdmin con iglesia seleccionada) */}
      {backButton}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          {churchName ? `Asistencia Semanal — ${churchName}` : 'Asistencia Semanal'}
        </Typography>
        {hasPermission('weekly_attendance', 'create') && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
            Registrar Semana
          </Button>
        )}
      </Box>

      {/* Tarjetas de resumen */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderLeft: '4px solid #1565C0' }}>
            <TrendingUpIcon sx={{ color: '#1565C0', fontSize: 32 }} />
            <Box>
              <Typography variant="h5" fontWeight={700}>{avgAttendance}</Typography>
              <Typography variant="caption" color="text.secondary">Promedio Semanal</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderLeft: '4px solid #2E7D32' }}>
            <GroupsIcon sx={{ color: '#2E7D32', fontSize: 32 }} />
            <Box>
              <Typography variant="h5" fontWeight={700}>{pagination.total}</Typography>
              <Typography variant="caption" color="text.secondary">Semanas Registradas</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, borderLeft: '4px solid #E65100' }}>
            <Typography variant="h5" fontWeight={700}>{maxAttendance}</Typography>
            <Typography variant="caption" color="text.secondary">Máxima ({filterYear})</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, borderLeft: '4px solid #6A1B9A' }}>
            <Typography variant="h5" fontWeight={700}>{minAttendance}</Typography>
            <Typography variant="caption" color="text.secondary">Mínima ({filterYear})</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filtro por año */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Año</InputLabel>
          <Select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} label="Año">
            {yearOptions.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">
          Mostrando registros del año {filterYear}
        </Typography>
      </Paper>

      {/* Tabla */}
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha de la Semana</TableCell>
                <TableCell align="center">Asistencia</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Notas</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Registrado por</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay registros de asistencia para {filterYear}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : records.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={14}>
                      {formatDate(r.week_date)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={r.attendance_count}
                      size="small"
                      color={r.attendance_count >= avgAttendance ? 'success' : 'default'}
                      variant={r.attendance_count >= avgAttendance ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.notes || '-'}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    {r.creator?.full_name || '-'}
                  </TableCell>
                  <TableCell align="right">
                    {hasPermission('weekly_attendance', 'edit') && (
                      <IconButton size="small" onClick={() => openEdit(r)} color="primary" title="Editar">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    {hasPermission('weekly_attendance', 'delete') && (
                      <IconButton size="small" onClick={() => handleDelete(r.id)} color="error" title="Eliminar">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={pagination.total} page={pagination.page}
          onPageChange={(_, p) => loadRecords(p)} rowsPerPage={52}
          rowsPerPageOptions={[52]}
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </Paper>

      {/* ===== DIALOG CREAR/EDITAR ===== */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="xs" fullWidth
        fullScreen={isMobile}>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editing ? 'Editar Registro' : 'Registrar Asistencia Semanal'}</DialogTitle>
          <DialogContent dividers>
            <Alert severity="info" sx={{ mb: 2 }}>
              Registre la asistencia del servicio principal de la semana.
              El promedio se calcula automáticamente.
            </Alert>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth required size="small" label="Fecha de la semana (domingo)"
                  type="date" InputLabelProps={{ shrink: true }}
                  value={form.week_date}
                  onChange={(e) => setForm({ ...form, week_date: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth required size="small" label="Número de asistentes"
                  type="number" inputProps={{ min: 0 }}
                  value={form.attendance_count}
                  onChange={(e) => setForm({ ...form, attendance_count: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth size="small" label="Notas (opcional)"
                  multiline rows={2} placeholder="Ej: Evento especial, lluvia, etc."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="contained" type="submit">
              {editing ? 'Actualizar' : 'Registrar'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

// ========================================================
// COMPONENTE PRINCIPAL: Envuelve con ChurchSelector
// SuperAdmin ve lista de iglesias primero
// ========================================================
const WeeklyAttendance = () => (
  <ChurchSelector title="Asistencia Semanal">
    {({ churchId, churchName, backButton }) => (
      <WeeklyAttendanceContent
        churchId={churchId}
        churchName={churchName}
        backButton={backButton}
      />
    )}
  </ChurchSelector>
);

export default WeeklyAttendance;

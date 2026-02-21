/**
 * Members.js - CRUD de miembros con MUI
 * 
 * Incluye:
 * - Campo 'birth_date' (fecha de nacimiento, opcional)
 * - Tipo 'Infante' adicional a Miembro, Visitante, Familiar, Otro
 * - Campo opcional 'church_role' (Cargo Ministerial)
 *   que al cambiar recalcula automáticamente los contadores
 *   en la tabla churches del backend.
 * - Al crear/eliminar un miembro se recalcula membership_count
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
  Box, Paper, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, FormControlLabel, Checkbox, CircularProgress, InputAdornment, TablePagination,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon,
} from '@mui/icons-material';

/** Tipos de miembro disponibles (incluye Infante) */
const MEMBER_TYPES = ['Miembro', 'Visitante', 'Familiar', 'Infante', 'Otro'];

/** Opciones de cargo ministerial (opcionales) */
const CHURCH_ROLES = [
  { value: '', label: 'Sin cargo' },
  { value: 'Predicador Ordenado', label: 'Predicador Ordenado' },
  { value: 'Predicador No Ordenado', label: 'Predicador No Ordenado' },
  { value: 'Diácono Ordenado', label: 'Diácono Ordenado' },
  { value: 'Diácono No Ordenado', label: 'Diácono No Ordenado' },
];

const emptyForm = {
  first_name: '', last_name: '', age: '', sex: '', birth_date: '',
  baptized: false, member_type: 'Miembro', church_role: '',
  phone: '', email: '', address: '',
};

const Members = () => {
  const { hasRole } = useAuth();
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, total: 0 });
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // ===== CARGA DE MIEMBROS =====
  const loadMembers = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const params = { page: page + 1, limit: 15 };
      if (search) params.search = search;
      if (filterType) params.member_type = filterType;
      if (filterRole) params.church_role = filterRole;
      const { data } = await api.get('/members', { params });
      setMembers(data.members);
      setPagination({ page, total: data.pagination.total });
    } catch (error) {
      toast.error('Error al cargar miembros');
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterRole]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ===== CREAR / EDITAR =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/members/${editing.id}`, form);
        toast.success('Miembro actualizado');
      } else {
        await api.post('/members', form);
        toast.success('Miembro creado');
      }
      setShowModal(false);
      loadMembers(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      first_name: m.first_name, last_name: m.last_name, age: m.age || '',
      sex: m.sex || '', birth_date: m.birth_date || '',
      baptized: m.baptized, member_type: m.member_type,
      church_role: m.church_role || '',
      phone: m.phone || '', email: m.email || '', address: m.address || '',
    });
    setShowModal(true);
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este miembro?')) return;
    try {
      await api.delete(`/members/${id}`);
      toast.success('Miembro eliminado');
      loadMembers(pagination.page);
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  // ===== HELPERS DE FORMATO =====

  /** Color del chip según tipo */
  const typeColor = (t) => {
    const map = {
      Miembro: 'primary', Visitante: 'warning', Familiar: 'success',
      Infante: 'info', Otro: 'default',
    };
    return map[t] || 'default';
  };

  /** Chip con abreviatura del cargo ministerial */
  const roleChip = (role) => {
    if (!role) return null;
    const colorMap = {
      'Predicador Ordenado': 'secondary',
      'Predicador No Ordenado': 'info',
      'Diácono Ordenado': 'success',
      'Diácono No Ordenado': 'warning',
    };
    const shortMap = {
      'Predicador Ordenado': 'Pred. Ord.',
      'Predicador No Ordenado': 'Pred. N/O',
      'Diácono Ordenado': 'Diác. Ord.',
      'Diácono No Ordenado': 'Diác. N/O',
    };
    return (
      <Chip label={shortMap[role] || role} size="small" color={colorMap[role] || 'default'} variant="outlined" />
    );
  };

  /** Formatear fecha de nacimiento */
  const formatBirthDate = (d) => {
    if (!d) return '-';
    return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Miembros</Typography>
        {hasRole('Administrador', 'Secretaría', 'Líder') && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Nuevo Miembro</Button>
        )}
      </Box>

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="Buscar por nombre o email..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 220, flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Tipo</InputLabel>
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} label="Tipo">
            <MenuItem value="">Todos</MenuItem>
            {MEMBER_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>Cargo Ministerial</InputLabel>
          <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} label="Cargo Ministerial">
            <MenuItem value="">Todos</MenuItem>
            {CHURCH_ROLES.filter((r) => r.value).map((r) => (
              <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* Tabla */}
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Edad</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>F. Nacimiento</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Sexo</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Cargo</TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Bautizado</TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Teléfono</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
              ) : members.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}>No se encontraron miembros</TableCell></TableRow>
              ) : members.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={14}>{m.first_name} {m.last_name}</Typography>
                    {/* En móvil mostrar cargo debajo del nombre */}
                    {m.church_role && (
                      <Box sx={{ display: { md: 'none' }, mt: 0.5 }}>
                        {roleChip(m.church_role)}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{m.age || '-'}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{formatBirthDate(m.birth_date)}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{m.sex === 'M' ? 'M' : m.sex === 'F' ? 'F' : '-'}</TableCell>
                  <TableCell><Chip label={m.member_type} size="small" color={typeColor(m.member_type)} /></TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    {m.church_role ? roleChip(m.church_role) : <Typography variant="caption" color="text.secondary">-</Typography>}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>{m.baptized ? '✅' : '❌'}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>{m.phone || '-'}</TableCell>
                  <TableCell align="right">
                    {hasRole('Administrador', 'Secretaría', 'Líder') && (
                      <IconButton size="small" onClick={() => openEdit(m)} color="primary"><EditIcon fontSize="small" /></IconButton>
                    )}
                    {hasRole('Administrador') && (
                      <IconButton size="small" onClick={() => handleDelete(m.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={pagination.total} page={pagination.page}
          onPageChange={(_, p) => loadMembers(p)} rowsPerPage={15}
          rowsPerPageOptions={[15]} labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </Paper>

      {/* ===== DIALOG CREAR/EDITAR ===== */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editing ? 'Editar Miembro' : 'Nuevo Miembro'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {/* Nombre y Apellido */}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required size="small" label="Nombre"
                  value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required size="small" label="Apellido"
                  value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </Grid>

              {/* Fecha de Nacimiento y Edad */}
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" label="Fecha de Nacimiento"
                  type="date" InputLabelProps={{ shrink: true }}
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField fullWidth size="small" label="Edad" type="number"
                  value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })}
                  inputProps={{ min: 0, max: 150 }}
                  helperText="Opcional si puso F. Nac."
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sexo</InputLabel>
                  <Select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} label="Sexo">
                    <MenuItem value="">-</MenuItem>
                    <MenuItem value="M">Masculino</MenuItem>
                    <MenuItem value="F">Femenino</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Tipo y Cargo Ministerial */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tipo</InputLabel>
                  <Select required value={form.member_type} onChange={(e) => setForm({ ...form, member_type: e.target.value })} label="Tipo">
                    {MEMBER_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Cargo Ministerial (opcional)</InputLabel>
                  <Select
                    value={form.church_role}
                    onChange={(e) => setForm({ ...form, church_role: e.target.value })}
                    label="Cargo Ministerial (opcional)"
                  >
                    {CHURCH_ROLES.map((r) => (
                      <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Contacto */}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Teléfono"
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Email" type="email"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Dirección" multiline rows={2}
                  value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Grid>

              {/* Bautizado */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Checkbox checked={form.baptized} onChange={(e) => setForm({ ...form, baptized: e.target.checked })} />}
                  label="Bautizado"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="contained" type="submit">{editing ? 'Actualizar' : 'Guardar'}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Members;

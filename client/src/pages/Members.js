/**
 * Members.js - CRUD de miembros con MUI
 * 
 * Incluye:
 * - Campo 'birth_date' (fecha de nacimiento, opcional)
 * - Tipo 'Infante' adicional a Miembro, Visitante, Familiar, Otro
 * - Cargo Ministerial DINÁMICO: cargado desde el módulo "Cargos Ministeriales"
 *   vía GET /api/ministerial-positions. Los cargos creados en esa sección
 *   se reflejan automáticamente en el select de este formulario.
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

const emptyForm = {
  first_name: '', last_name: '', age: '', sex: '', birth_date: '',
  baptized: false, member_type: 'Miembro',
  /**
   * position_id: FK a ministerial_positions (sistema nuevo, escalable).
   * Este campo almacena el ID del cargo ministerial seleccionado
   * que proviene del CRUD de "Cargos Ministeriales".
   */
  position_id: '',
  phone: '', email: '', address: '',
};

const Members = () => {
  const { hasRole } = useAuth();
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, total: 0 });
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  /**
   * Cargos ministeriales dinámicos obtenidos del endpoint
   * GET /api/ministerial-positions.
   * Solo se muestran los activos (is_active = true) de la iglesia del usuario.
   * Estos son los mismos cargos que se crean en la sección "Cargos Ministeriales".
   */
  const [positions, setPositions] = useState([]);

  // ===== CARGA DE CARGOS MINISTERIALES =====
  /**
   * Se cargan al montar el componente para tener disponibles
   * tanto en los filtros como en el formulario de crear/editar.
   */
  const loadPositions = useCallback(async () => {
    try {
      const { data } = await api.get('/ministerial-positions');
      // Filtrar solo cargos activos para el select
      const active = (data.positions || []).filter((p) => p.is_active);
      setPositions(active);
    } catch (error) {
      console.error('Error al cargar cargos ministeriales:', error);
      // Si falla, el select mostrará solo "Sin cargo"
    }
  }, []);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  // ===== CARGA DE MIEMBROS =====
  const loadMembers = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const params = { page: page + 1, limit: 15 };
      if (search) params.search = search;
      if (filterType) params.member_type = filterType;
      // Filtrar por position_id (cargo ministerial dinámico)
      if (filterPosition) params.position_id = filterPosition;
      const { data } = await api.get('/members', { params });
      setMembers(data.members);
      setPagination({ page, total: data.pagination.total });
    } catch (error) {
      toast.error('Error al cargar miembros');
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterPosition]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ===== CREAR / EDITAR =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Preparar datos: enviar position_id como número o null
      const payload = {
        ...form,
        position_id: form.position_id || null,
      };

      if (editing) {
        await api.put(`/members/${editing.id}`, payload);
        toast.success('Miembro actualizado');
      } else {
        await api.post('/members', payload);
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
      /**
       * Al editar, cargar el position_id actual del miembro.
       * Si el miembro tiene un cargo asignado via FK, se pre-selecciona.
       */
      position_id: m.position_id || '',
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

  /**
   * Muestra el nombre del cargo ministerial como Chip.
   * Busca primero en la relación 'position' (FK nuevo),
   * luego cae al campo legacy 'church_role' (texto estático).
   */
  const getPositionDisplay = (member) => {
    // Prioridad 1: cargo dinámico via position (relación incluida por el backend)
    if (member.position) {
      return (
        <Chip label={member.position.name} size="small" color="secondary" variant="outlined" />
      );
    }
    // Prioridad 2: cargo legacy (texto estático en church_role)
    if (member.church_role) {
      return (
        <Chip label={member.church_role} size="small" color="default" variant="outlined" />
      );
    }
    return <Typography variant="caption" color="text.secondary">-</Typography>;
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
        {/* Filtro de cargo ministerial: usa cargos dinámicos de la BD */}
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>Cargo Ministerial</InputLabel>
          <Select value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)} label="Cargo Ministerial">
            <MenuItem value="">Todos</MenuItem>
            {positions.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
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
                    {(m.position || m.church_role) && (
                      <Box sx={{ display: { md: 'none' }, mt: 0.5 }}>
                        {getPositionDisplay(m)}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{m.age || '-'}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{formatBirthDate(m.birth_date)}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{m.sex === 'M' ? 'M' : m.sex === 'F' ? 'F' : '-'}</TableCell>
                  <TableCell><Chip label={m.member_type} size="small" color={typeColor(m.member_type)} /></TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    {getPositionDisplay(m)}
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

              {/* Tipo de miembro */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tipo</InputLabel>
                  <Select required value={form.member_type} onChange={(e) => setForm({ ...form, member_type: e.target.value })} label="Tipo">
                    {MEMBER_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              {/*
                * CARGO MINISTERIAL DINÁMICO:
                * Las opciones provienen del módulo "Cargos Ministeriales"
                * (GET /api/ministerial-positions). Cuando el admin crea un cargo
                * nuevo en esa sección, aparece automáticamente aquí.
                * Se guarda como position_id (FK a ministerial_positions).
                */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Cargo Ministerial (opcional)</InputLabel>
                  <Select
                    value={form.position_id}
                    onChange={(e) => setForm({ ...form, position_id: e.target.value })}
                    label="Cargo Ministerial (opcional)"
                  >
                    <MenuItem value="">Sin cargo</MenuItem>
                    {positions.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
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

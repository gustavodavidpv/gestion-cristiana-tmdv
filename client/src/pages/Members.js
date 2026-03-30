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
 *
 * SUPERADMIN: Usa ChurchSelector para seleccionar iglesia primero.
 * Al entrar a una iglesia, los miembros se filtran por church_id.
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
  Grid, FormControlLabel, Checkbox, CircularProgress, InputAdornment, TablePagination,
  useMediaQuery, useTheme,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon,
} from '@mui/icons-material';

/** Tipos de miembro disponibles (incluye Infante y Candidato a bautismo) */
const MEMBER_TYPES = ['Miembro', 'Visitante', 'Familiar', 'Infante', 'Candidato a bautismo', 'Otro'];

/** Opciones de meses para el filtro de cumpleaños */
const MONTH_OPTIONS = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

const emptyForm = {
  first_name: '', last_name: '', age: '', sex: '', birth_date: '',
  baptized: false, member_type: 'Miembro',
  /**
   * position_ids: Array de IDs de cargos ministeriales (M:N).
   * Un miembro puede tener múltiples cargos simultáneamente.
   * Reemplaza el antiguo position_id (1:N) en el frontend.
   */
  position_ids: [],
  phone: '', email: '', address: '',
};

/**
 * MembersContent - Contenido principal del módulo de miembros.
 * Recibe churchId y churchName del ChurchSelector (null si no es SuperAdmin).
 */
const MembersContent = ({ churchId, churchName, backButton }) => {
  const { hasRole } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, total: 0 });
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  /**
   * filterPosition: Array de IDs para filtro multi-select de cargos.
   * Permite seleccionar varios cargos simultáneamente (F5).
   */
  const [filterPosition, setFilterPosition] = useState([]);
  const [filterBirthMonth, setFilterBirthMonth] = useState(''); // Filtro por mes de cumpleaños
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
   * Si churchId está disponible (SuperAdmin), se pasa como filtro.
   */
  const loadPositions = useCallback(async () => {
    try {
      const params = {};
      if (churchId) params.church_id = churchId;
      const { data } = await api.get('/ministerial-positions', { params });
      // Filtrar solo cargos activos para el select
      const active = (data.positions || []).filter((p) => p.is_active);
      setPositions(active);
    } catch (error) {
      console.error('Error al cargar cargos ministeriales:', error);
      // Si falla, el select mostrará solo "Sin cargo"
    }
  }, [churchId]);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  // ===== CARGA DE MIEMBROS =====
  const loadMembers = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const params = { page: page + 1, limit: 15 };
      // SuperAdmin: filtrar por la iglesia seleccionada
      if (churchId) params.church_id = churchId;
      if (search) params.search = search;
      if (filterType) params.member_type = filterType;
      // Filtrar por cargos ministeriales (multi-select, comma-separated)
      if (filterPosition.length > 0) params.position_ids = filterPosition.join(',');
      // Filtrar por mes de cumpleaños (ej: '04' para abril)
      if (filterBirthMonth) params.birth_month = filterBirthMonth;
      const { data } = await api.get('/members', { params });
      setMembers(data.members);
      setPagination({ page, total: data.pagination.total });
    } catch (error) {
      toast.error('Error al cargar miembros');
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterPosition, filterBirthMonth, churchId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ===== CREAR / EDITAR =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Preparar datos: enviar position_ids[] (M:N) al backend
      const payload = {
        ...form,
        position_ids: form.position_ids.length > 0 ? form.position_ids : [],
      };
      // Eliminar position_id legacy del payload (el backend lo maneja desde position_ids)
      delete payload.position_id;
      // SuperAdmin: enviar church_id explícitamente al crear
      if (churchId && !editing) {
        payload.church_id = churchId;
      }

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
       * Al editar, cargar position_ids desde la relación M:N (positions[]).
       * Si el miembro tiene cargos asignados via junction table, se pre-seleccionan.
       * Fallback: si solo tiene position_id legacy (1:N), usarlo como array de 1.
       */
      position_ids: m.positions && m.positions.length > 0
        ? m.positions.map(p => p.id)
        : (m.position_id ? [m.position_id] : []),
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
      Infante: 'info', 'Candidato a bautismo': 'secondary', Otro: 'default',
    };
    return map[t] || 'default';
  };

  /**
   * Muestra los cargos ministeriales como Chips.
   * Prioridad: positions[] (M:N) → position (1:N legacy) → church_role (texto legacy).
   */
  const getPositionDisplay = (member) => {
    // Prioridad 1: cargos M:N desde junction table (array de objetos con id, name)
    if (member.positions && member.positions.length > 0) {
      return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {member.positions.map(p => (
            <Chip key={p.id} label={p.name} size="small" color="secondary" variant="outlined" />
          ))}
        </Box>
      );
    }
    // Prioridad 2: cargo 1:N legacy via position FK
    if (member.position) {
      return <Chip label={member.position.name} size="small" color="secondary" variant="outlined" />;
    }
    // Prioridad 3: cargo legacy (texto estático en church_role)
    if (member.church_role) {
      return <Chip label={member.church_role} size="small" color="default" variant="outlined" />;
    }
    return <Typography variant="caption" color="text.secondary">-</Typography>;
  };

  /**
   * Formatear fecha de cumpleaños (formato MM-DD → "15 de marzo").
   * Solo muestra mes y día, sin año, porque solo interesa el cumpleaños.
   */
  const formatBirthDate = (d) => {
    if (!d) return '-';
    const monthNames = ['enero','febrero','marzo','abril','mayo','junio',
      'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const parts = d.split('-');
    if (parts.length !== 2) return d; // Fallback si formato inesperado
    const monthIdx = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    if (monthIdx < 0 || monthIdx > 11 || isNaN(day)) return d;
    return `${day} de ${monthNames[monthIdx]}`;
  };

  return (
    <Box>
      {/* Botón volver (solo SuperAdmin con iglesia seleccionada) */}
      {backButton}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          Miembros{churchName ? ` — ${churchName}` : ''}
        </Typography>
        {hasRole('Administrador', 'Secretaría', 'Líder') && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Nuevo Miembro</Button>
        )}
      </Box>

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' } }}>
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
        {/* Filtro multi-select de cargo ministerial (F5) */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Cargo Ministerial</InputLabel>
          <Select
            multiple
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            label="Cargo Ministerial"
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map(id => {
                  const pos = positions.find(p => p.id === id);
                  return pos ? <Chip key={id} label={pos.name} size="small"
                    onDelete={() => setFilterPosition(prev => prev.filter(v => v !== id))}
                    onMouseDown={(e) => e.stopPropagation()} /> : null;
                })}
              </Box>
            )}
          >
            {positions.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* Filtro por mes de cumpleaños */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Mes Cumpleaños</InputLabel>
          <Select value={filterBirthMonth} onChange={(e) => setFilterBirthMonth(e.target.value)} label="Mes Cumpleaños">
            <MenuItem value="">Todos</MenuItem>
            {MONTH_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Paper>

      {/* Vista móvil: cards de miembros */}
      {isMobile ? (
        <Box>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
          ) : members.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No se encontraron miembros</Typography>
          ) : members.map((m) => (
            <Paper key={m.id} sx={{ p: 2, mb: 1.5, borderLeft: '4px solid #1565C0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={600} fontSize={14}>{m.first_name} {m.last_name}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    <Chip label={m.member_type} size="small" color={typeColor(m.member_type)} />
                    {m.baptized && <Chip label="Bautizado" size="small" color="info" variant="outlined" />}
                  </Box>
                  {(m.positions?.length > 0 || m.position || m.church_role) && (
                    <Box sx={{ mt: 0.5 }}>{getPositionDisplay(m)}</Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {hasRole('Administrador', 'Secretaría', 'Líder') && (
                    <IconButton size="small" onClick={() => openEdit(m)} color="primary"><EditIcon fontSize="small" /></IconButton>
                  )}
                  {hasRole('Administrador') && (
                    <IconButton size="small" onClick={() => handleDelete(m.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {m.phone && <Typography variant="caption" color="text.secondary">{m.phone}</Typography>}
                {m.birth_date && <Typography variant="caption" color="text.secondary">{formatBirthDate(m.birth_date)}</Typography>}
                {m.age && <Typography variant="caption" color="text.secondary">{m.age} años</Typography>}
              </Box>
            </Paper>
          ))}
          <TablePagination
            component="div" count={pagination.total} page={pagination.page}
            onPageChange={(_, p) => loadMembers(p)} rowsPerPage={15}
            rowsPerPageOptions={[15]} labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          />
        </Box>
      ) : (
      /* Vista desktop: tabla de miembros */
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Edad</TableCell>
                <TableCell>F. Nacimiento</TableCell>
                <TableCell>Sexo</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Cargo</TableCell>
                <TableCell>Bautizado</TableCell>
                <TableCell>Teléfono</TableCell>
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
                  </TableCell>
                  <TableCell>{m.age || '-'}</TableCell>
                  <TableCell>{formatBirthDate(m.birth_date)}</TableCell>
                  <TableCell>{m.sex === 'M' ? 'M' : m.sex === 'F' ? 'F' : '-'}</TableCell>
                  <TableCell><Chip label={m.member_type} size="small" color={typeColor(m.member_type)} /></TableCell>
                  <TableCell>{getPositionDisplay(m)}</TableCell>
                  <TableCell>{m.baptized ? '✅' : '❌'}</TableCell>
                  <TableCell>{m.phone || '-'}</TableCell>
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
      )}

      {/* ===== DIALOG CREAR/EDITAR ===== */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="sm" fullWidth
        fullScreen={isMobile}>
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

              {/* Cumpleaños (solo mes y día, sin año) */}
              <Grid item xs={6} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Mes Nac.</InputLabel>
                  <Select
                    value={form.birth_date ? form.birth_date.split('-')[0] || '' : ''}
                    onChange={(e) => {
                      const month = e.target.value;
                      const day = form.birth_date ? form.birth_date.split('-')[1] || '' : '';
                      setForm({ ...form, birth_date: month && day ? `${month}-${day}` : (month ? `${month}-` : '') });
                    }}
                    label="Mes Nac."
                  >
                    <MenuItem value=""><em>—</em></MenuItem>
                    {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((name, i) => (
                      <MenuItem key={i} value={String(i + 1).padStart(2, '0')}>{name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Día</InputLabel>
                  <Select
                    value={form.birth_date ? form.birth_date.split('-')[1] || '' : ''}
                    onChange={(e) => {
                      const day = e.target.value;
                      const month = form.birth_date ? form.birth_date.split('-')[0] || '' : '';
                      setForm({ ...form, birth_date: month && day ? `${month}-${day}` : '' });
                    }}
                    label="Día"
                  >
                    <MenuItem value=""><em>—</em></MenuItem>
                    {Array.from({ length: 31 }, (_, i) => (
                      <MenuItem key={i} value={String(i + 1).padStart(2, '0')}>{i + 1}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
                * CARGO MINISTERIAL DINÁMICO (M:N):
                * Multi-select que permite asignar múltiples cargos a un miembro.
                * Las opciones provienen de GET /api/ministerial-positions.
                * Se envían como position_ids[] al backend.
                */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Cargo Ministerial (opcional)</InputLabel>
                  <Select
                    multiple
                    value={form.position_ids}
                    onChange={(e) => setForm({ ...form, position_ids: e.target.value })}
                    label="Cargo Ministerial (opcional)"
                    renderValue={(selected) =>
                      selected.length === 0 ? '' : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map(id => {
                            const pos = positions.find(p => p.id === id);
                            return pos ? <Chip key={id} label={pos.name} size="small" /> : null;
                          })}
                        </Box>
                      )
                    }
                  >
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

/**
 * Members - Componente principal.
 * Usa ChurchSelector para que SuperAdmin seleccione iglesia primero.
 * Para otros roles, renderiza MembersContent directamente.
 */
const Members = () => {
  return (
    <ChurchSelector title="Miembros">
      {({ churchId, churchName, backButton }) => (
        <MembersContent
          churchId={churchId}
          churchName={churchName}
          backButton={backButton}
        />
      )}
    </ChurchSelector>
  );
};

export default Members;

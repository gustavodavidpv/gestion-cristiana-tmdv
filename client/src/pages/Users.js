/**
 * Users.js - Gestión de usuarios del sistema (solo Admin) con MUI
 * 
 * CRUD completo: Crear, editar, activar/desactivar, reset password, eliminar
 * Filtros por nombre/email y por rol
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  Box, Paper, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, CircularProgress, TablePagination, InputAdornment, FormControlLabel,
  Checkbox, Alert,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon,
  VpnKey as KeyIcon, PersonOff as DisableIcon, PersonAdd as EnableIcon,
} from '@mui/icons-material';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [churches, setChurches] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Modal CRUD
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role_id: '', church_id: '', is_active: true });

  // Modal Reset Password
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');

  const loadUsers = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const params = { page: page + 1, limit: 15 };
      if (search) params.search = search;
      if (filterRole) params.role_id = filterRole;
      const { data } = await api.get('/users', { params });
      setUsers(data.users);
      setPagination({ page, total: data.pagination.total });
    } catch (error) {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [search, filterRole]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [rolesRes, churchesRes] = await Promise.all([
          api.get('/users/roles'),
          api.get('/churches'),
        ]);
        setRoles(rolesRes.data.roles);
        setChurches(churchesRes.data.churches || []);
      } catch (error) {
        console.error('Error loading metadata');
      }
    };
    loadMeta();
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openNew = () => {
    setEditing(null);
    setForm({ full_name: '', email: '', password: '', role_id: roles[0]?.id || '', church_id: '', is_active: true });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ full_name: u.full_name, email: u.email, password: '', role_id: u.role_id, church_id: u.church_id || '', is_active: u.is_active });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (editing) {
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editing.id}`, payload);
        toast.success('Usuario actualizado');
      } else {
        if (!payload.password || payload.password.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres');
          return;
        }
        await api.post('/users', payload);
        toast.success('Usuario creado');
      }
      setShowModal(false);
      loadUsers(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario "${u.full_name}"?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('Usuario eliminado');
      loadUsers(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al eliminar');
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      toast.success(`Usuario ${u.is_active ? 'desactivado' : 'activado'}`);
      loadUsers(pagination.page);
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
  };

  const openResetPw = (u) => { setResetUser(u); setResetPassword(''); setShowResetModal(true); };

  const handleResetPw = async (e) => {
    e.preventDefault();
    if (resetPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    try {
      await api.post(`/auth/admin-reset-password/${resetUser.id}`, { new_password: resetPassword });
      toast.success(`Contraseña de ${resetUser.full_name} restablecida`);
      setShowResetModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error');
    }
  };

  const roleColor = (r) => {
    const map = { Administrador: 'secondary', Secretaría: 'primary', Líder: 'success', Visitante: 'default' };
    return map[r] || 'default';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Gestión de Usuarios</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Nuevo Usuario</Button>
      </Box>

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="Buscar nombre o email..." value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 250, flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Rol</InputLabel>
          <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} label="Rol">
            <MenuItem value="">Todos</MenuItem>
            {roles.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
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
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Email</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Iglesia</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>No se encontraron usuarios</TableCell></TableRow>
              ) : users.map((u) => (
                <TableRow key={u.id} hover sx={{ opacity: u.is_active ? 1 : 0.5 }}>
                  <TableCell><Typography fontWeight={600} fontSize={14}>{u.full_name}</Typography></TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{u.email}</TableCell>
                  <TableCell><Chip label={u.role?.name} size="small" color={roleColor(u.role?.name)} /></TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{u.church?.name || '-'}</TableCell>
                  <TableCell>
                    <Chip label={u.is_active ? 'Activo' : 'Inactivo'} size="small"
                      color={u.is_active ? 'success' : 'error'} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(u)} color="primary" title="Editar"><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => openResetPw(u)} color="warning" title="Reset contraseña"><KeyIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => toggleActive(u)} color={u.is_active ? 'warning' : 'success'}
                      title={u.is_active ? 'Desactivar' : 'Activar'}>
                      {u.is_active ? <DisableIcon fontSize="small" /> : <EnableIcon fontSize="small" />}
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(u)} color="error" title="Eliminar"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={pagination.total} page={pagination.page}
          onPageChange={(_, p) => loadUsers(p)} rowsPerPage={15} rowsPerPageOptions={[15]}
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`} />
      </Paper>

      {/* Dialog CRUD */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField fullWidth required size="small" label="Nombre completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth required size="small" label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label={editing ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña'} type="password"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editing} inputProps={{ minLength: !editing ? 6 : 0 }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Rol</InputLabel>
                  <Select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} label="Rol">
                    {roles.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Iglesia</InputLabel>
                  <Select value={form.church_id} onChange={(e) => setForm({ ...form, church_id: e.target.value })} label="Iglesia">
                    <MenuItem value="">Sin asignar</MenuItem>
                    {churches.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              {editing && (
                <Grid item xs={12}>
                  <FormControlLabel control={<Checkbox checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />}
                    label="Usuario activo" />
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="contained" type="submit">{editing ? 'Actualizar' : 'Crear'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog Reset Password */}
      <Dialog open={showResetModal} onClose={() => setShowResetModal(false)} maxWidth="xs" fullWidth>
        {resetUser && (
          <form onSubmit={handleResetPw}>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
            <DialogContent dividers>
              <Alert severity="info" sx={{ mb: 2 }}>
                Establecer nueva contraseña para: <strong>{resetUser.full_name}</strong>
                <br /><Typography variant="caption" color="text.secondary">{resetUser.email}</Typography>
              </Alert>
              <TextField fullWidth required size="small" label="Nueva contraseña" type="password"
                value={resetPassword} onChange={(e) => setResetPassword(e.target.value)}
                inputProps={{ minLength: 6 }} helperText="Mínimo 6 caracteres" />
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setShowResetModal(false)}>Cancelar</Button>
              <Button variant="contained" type="submit">Restablecer</Button>
            </DialogActions>
          </form>
        )}
      </Dialog>
    </Box>
  );
};

export default Users;

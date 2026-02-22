/**
 * MinisterialPositions.js - CRUD de cargos ministeriales por iglesia
 * 
 * Admin: ve/edita cargos de su iglesia.
 * SuperAdmin: ve/edita cargos de cualquier iglesia.
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, CircularProgress, Switch, FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Badge as BadgeIcon,
} from '@mui/icons-material';

const MinisterialPositions = () => {
  const { hasRole, isSuperAdmin } = useAuth();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });

  const loadPositions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ministerial-positions');
      setPositions(data.positions);
    } catch (error) {
      toast.error('Error al cargar cargos ministeriales');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/ministerial-positions/${editing.id}`, form);
        toast.success('Cargo actualizado');
      } else {
        await api.post('/ministerial-positions', form);
        toast.success('Cargo creado');
      }
      setShowModal(false);
      loadPositions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', is_active: true });
    setShowModal(true);
  };

  const openEdit = (pos) => {
    setEditing(pos);
    setForm({ name: pos.name, description: pos.description || '', is_active: pos.is_active });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este cargo ministerial?')) return;
    try {
      await api.delete(`/ministerial-positions/${id}`);
      toast.success('Cargo eliminado');
      loadPositions();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BadgeIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Cargos Ministeriales</Typography>
        </Box>
        {hasRole('Administrador') && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Nuevo Cargo</Button>
        )}
      </Box>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Descripción</TableCell>
                {isSuperAdmin() && <TableCell>Iglesia</TableCell>}
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
              ) : positions.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>No hay cargos registrados</TableCell></TableRow>
              ) : positions.map((pos) => (
                <TableRow key={pos.id} hover>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={14}>{pos.name}</Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pos.description || '-'}
                  </TableCell>
                  {isSuperAdmin() && (
                    <TableCell>
                      <Chip label={pos.church?.name || '-'} size="small" variant="outlined" />
                    </TableCell>
                  )}
                  <TableCell align="center">
                    <Chip label={pos.is_active ? 'Activo' : 'Inactivo'} size="small"
                      color={pos.is_active ? 'success' : 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(pos)} color="primary" title="Editar">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {hasRole('Administrador') && (
                      <IconButton size="small" onClick={() => handleDelete(pos.id)} color="error" title="Eliminar">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog Crear/Editar */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editing ? 'Editar Cargo' : 'Nuevo Cargo Ministerial'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField fullWidth required size="small" label="Nombre del cargo"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Pastor, Diácono Ordenado, Líder de Jóvenes" />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Descripción" multiline rows={3}
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Grid>
              {editing && (
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />}
                    label={form.is_active ? 'Activo (visible para asignar)' : 'Inactivo (oculto)'}
                  />
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="contained" type="submit">{editing ? 'Actualizar' : 'Crear Cargo'}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default MinisterialPositions;

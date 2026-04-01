import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

const emptyForm = { name: '', description: '' };

const Roles = () => {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/roles');
      setRoles(data.roles || []);
    } catch (error) {
      toast.error('Error al cargar roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (role) => {
    setEditing(role);
    setForm({
      name: role.name || '',
      description: role.description || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
      };

      if (editing) {
        await api.put(`/roles/${editing.id}`, payload);
        toast.success('Rol actualizado correctamente');
        closeModal();
        await loadRoles();
      } else {
        const { data } = await api.post('/roles', payload);
        toast.success('Rol creado correctamente. Ahora puedes asignarle permisos.');
        closeModal();
        navigate(`/permissions?roleId=${data.role.id}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar el rol');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`¿Eliminar el rol "${role.name}"?`)) return;

    try {
      await api.delete(`/roles/${role.id}`);
      toast.success('Rol eliminado correctamente');
      await loadRoles();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al eliminar el rol');
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>Gestion de Roles</Typography>
          <Typography variant="body2" color="text.secondary">
            Crea roles nuevos y luego configuralos desde el modulo de permisos.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nuevo Rol
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Los roles del sistema, incluyendo <strong>Asistencia</strong>, quedan protegidos.
        Los roles nuevos se crean sin permisos activos y luego se configuran en <strong>Permisos</strong>.
      </Alert>

      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Rol</TableCell>
                  <TableCell>Descripcion</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Usuarios</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      No hay roles disponibles.
                    </TableCell>
                  </TableRow>
                ) : roles.map((role) => (
                  <TableRow key={role.id} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{role.name}</Typography>
                    </TableCell>
                    <TableCell>{role.description || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={role.is_system ? 'Sistema' : 'Personalizado'}
                        color={role.is_system ? 'primary' : 'default'}
                        variant={role.is_system ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>{role.users_count ?? 0}</TableCell>
                    <TableCell align="right">
                      {role.name !== 'SuperAdmin' && (
                        <IconButton
                          size="small"
                          color="secondary"
                          title="Configurar permisos"
                          onClick={() => navigate(`/permissions?roleId=${role.id}`)}
                        >
                          <SecurityIcon fontSize="small" />
                        </IconButton>
                      )}
                      {!role.is_system && (
                        <IconButton
                          size="small"
                          color="primary"
                          title="Editar"
                          onClick={() => openEdit(role)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      {!role.is_system && (
                        <IconButton
                          size="small"
                          color="error"
                          title="Eliminar"
                          onClick={() => handleDelete(role)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={showModal} onClose={closeModal} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editing ? 'Editar Rol' : 'Nuevo Rol'}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Nombre del rol"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                fullWidth
                autoFocus
                inputProps={{ maxLength: 50 }}
              />
              <TextField
                label="Descripcion"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                fullWidth
                multiline
                minRows={3}
                inputProps={{ maxLength: 250 }}
                helperText="Opcional. Te ayuda a identificar el proposito del rol."
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Guardando...' : (editing ? 'Actualizar' : 'Crear')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Roles;

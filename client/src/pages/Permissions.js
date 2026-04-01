import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
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
  Paper,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  RestartAlt as ResetIcon,
  Save as SaveIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { MODULES, ACTION_LABELS, ALL_ACTIONS } from '../config/permissions';

const Permissions = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [permMatrix, setPermMatrix] = useState({});
  const [originalMatrix, setOriginalMatrix] = useState({});
  const [selectedTab, setSelectedTab] = useState(0);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/permissions');
      setRoles(data.roles || []);
      setPermMatrix(data.permissions || {});
      setOriginalMatrix(JSON.parse(JSON.stringify(data.permissions || {})));
    } catch (error) {
      toast.error('Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    if (!roles.length) return;

    const params = new URLSearchParams(location.search);
    const requestedRoleId = parseInt(params.get('roleId'), 10);

    if (Number.isNaN(requestedRoleId)) {
      if (selectedTab >= roles.length) {
        setSelectedTab(0);
      }
      return;
    }

    const roleIndex = roles.findIndex((role) => role.id === requestedRoleId);
    if (roleIndex >= 0 && roleIndex !== selectedTab) {
      setSelectedTab(roleIndex);
    }
  }, [location.search, roles, selectedTab]);

  const isDirty = JSON.stringify(permMatrix) !== JSON.stringify(originalMatrix);
  const currentRole = roles[selectedTab];
  const currentRoleId = currentRole?.id;

  const togglePermission = (moduleKey, action) => {
    if (!currentRoleId) return;

    setPermMatrix((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      const currentValue = updated[currentRoleId][moduleKey][action];
      updated[currentRoleId][moduleKey][action] = !currentValue;

      if (action === 'view' && currentValue === true) {
        const moduleConfig = MODULES.find((module) => module.key === moduleKey);
        if (moduleConfig) {
          for (const moduleAction of moduleConfig.actions) {
            if (moduleAction !== 'view') {
              updated[currentRoleId][moduleKey][moduleAction] = false;
            }
          }
        }
      }

      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/permissions', { permissions: permMatrix });
      setOriginalMatrix(JSON.parse(JSON.stringify(permMatrix)));
      toast.success('Permisos actualizados correctamente');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar permisos');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setShowResetDialog(false);
    await loadPermissions();
    toast.info('Permisos restaurados a los valores del servidor');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Gestion de Permisos</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ResetIcon />}
            onClick={() => setShowResetDialog(true)}
            disabled={!isDirty}
          >
            Restaurar
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>SuperAdmin</strong> siempre tiene acceso total y no aparece aqui.
        Configura los permisos de cada rol para controlar que puede ver, crear, editar o eliminar en cada modulo.
        Los roles creados desde <strong>Roles</strong> tambien se configuran aqui.
      </Alert>

      {isDirty && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Hay cambios sin guardar. Presiona "Guardar Cambios" para aplicarlos.
        </Alert>
      )}

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={selectedTab}
          onChange={(_, value) => setSelectedTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {roles.map((role, index) => (
            <Tab key={role.id} label={role.name} value={index} />
          ))}
        </Tabs>
      </Paper>

      {currentRole && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{ bgcolor: '#1565C0', color: '#fff', fontWeight: 700, minWidth: 180 }}
                >
                  Modulo
                </TableCell>
                {ALL_ACTIONS.map((action) => (
                  <TableCell
                    key={action}
                    align="center"
                    sx={{ bgcolor: '#1565C0', color: '#fff', fontWeight: 700, minWidth: 90 }}
                  >
                    {ACTION_LABELS[action]}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {MODULES.map((module) => {
                const modulePerms = permMatrix[currentRoleId]?.[module.key] || {};
                const viewEnabled = modulePerms.view !== false;

                return (
                  <TableRow key={module.key} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{module.label}</Typography>
                        {!viewEnabled && module.actions.length > 1 && (
                          <Chip label="Sin acceso" size="small" color="default" sx={{ fontSize: 10 }} />
                        )}
                      </Box>
                    </TableCell>
                    {ALL_ACTIONS.map((action) => {
                      const actionExists = module.actions.includes(action);
                      if (!actionExists) {
                        return (
                          <TableCell key={action} align="center">
                            <Typography variant="caption" color="text.disabled">-</Typography>
                          </TableCell>
                        );
                      }

                      const isChecked = !!modulePerms[action];
                      const isDisabled = action !== 'view' && !viewEnabled;

                      return (
                        <TableCell key={action} align="center">
                          <Tooltip
                            title={
                              isDisabled
                                ? 'Se requiere permiso de "Ver" para habilitar otras acciones'
                                : `${isChecked ? 'Desactivar' : 'Activar'} ${ACTION_LABELS[action]}`
                            }
                          >
                            <span>
                              <Switch
                                size="small"
                                checked={isChecked}
                                disabled={isDisabled}
                                onChange={() => togglePermission(module.key, action)}
                                color={action === 'delete' ? 'error' : action === 'attendance' ? 'warning' : 'success'}
                              />
                            </span>
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={showResetDialog} onClose={() => setShowResetDialog(false)} maxWidth="xs">
        <DialogTitle>Restaurar permisos</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Desea descartar los cambios no guardados y restaurar los permisos desde el servidor?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResetDialog(false)}>Cancelar</Button>
          <Button variant="contained" color="warning" onClick={handleResetDefaults}>Restaurar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Permissions;

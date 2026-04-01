/**
 * Permissions.js - Gestión de permisos CRUD por rol (Solo SuperAdmin)
 *
 * UI de matriz interactiva: filas = módulos, columnas = acciones.
 * Tabs por rol (Administrador, Secretaría, Líder, Visitante).
 * Los cambios se envían en bloque al guardar.
 *
 * SuperAdmin siempre tiene acceso total — no se gestionan sus permisos.
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { MODULES, ACTION_LABELS, ALL_ACTIONS } from '../config/permissions';
import {
  Box, Paper, Typography, Button, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Switch, Tabs, Tab, CircularProgress, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip,
} from '@mui/material';
import {
  Save as SaveIcon, RestartAlt as ResetIcon, Security as SecurityIcon,
} from '@mui/icons-material';

const Permissions = () => {
  // === Estados ===
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]); // Roles editables (sin SuperAdmin)
  const [permMatrix, setPermMatrix] = useState({}); // { [roleId]: { [module]: { [action]: bool } } }
  const [originalMatrix, setOriginalMatrix] = useState({}); // Copia para detectar cambios
  const [selectedTab, setSelectedTab] = useState(0);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // === Carga de datos ===
  const loadPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/permissions');
      setRoles(data.roles);
      setPermMatrix(data.permissions);
      // Copia profunda para comparar cambios
      setOriginalMatrix(JSON.parse(JSON.stringify(data.permissions)));
    } catch (error) {
      toast.error('Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  // === Detectar si hay cambios sin guardar ===
  const isDirty = JSON.stringify(permMatrix) !== JSON.stringify(originalMatrix);

  // === Rol actual seleccionado ===
  const currentRole = roles[selectedTab];
  const currentRoleId = currentRole?.id;

  // === Toggle de un permiso individual ===
  const togglePermission = (moduleKey, action) => {
    if (!currentRoleId) return;
    setPermMatrix((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      const currentValue = updated[currentRoleId][moduleKey][action];
      updated[currentRoleId][moduleKey][action] = !currentValue;

      // Si se desactiva "view", desactivar todas las demás acciones del módulo
      if (action === 'view' && currentValue === true) {
        const mod = MODULES.find((m) => m.key === moduleKey);
        if (mod) {
          for (const a of mod.actions) {
            if (a !== 'view') updated[currentRoleId][moduleKey][a] = false;
          }
        }
      }

      return updated;
    });
  };

  // === Guardar permisos ===
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

  // === Restaurar valores por defecto del rol actual ===
  const handleResetDefaults = async () => {
    setShowResetDialog(false);
    // Recargar desde el server (que tiene los defaults originales si no se han modificado)
    // Alternativa: restaurar a originalMatrix, pero mejor recargar para tener los defaults reales
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
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Gestión de Permisos</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<ResetIcon />} onClick={() => setShowResetDialog(true)}
            disabled={!isDirty}>
            Restaurar
          </Button>
          <Button variant="contained" startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </Box>
      </Box>

      {/* Info */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>SuperAdmin</strong> siempre tiene acceso total y no aparece aquí.
        Configure los permisos de cada rol para controlar qué pueden ver, crear, editar o eliminar en cada módulo.
      </Alert>

      {isDirty && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Hay cambios sin guardar. Presione "Guardar Cambios" para aplicarlos.
        </Alert>
      )}

      {/* Tabs por rol */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)}
          variant="scrollable" scrollButtons="auto">
          {roles.map((role, idx) => (
            <Tab key={role.id} label={role.name} value={idx} />
          ))}
        </Tabs>
      </Paper>

      {/* Matriz de permisos */}
      {currentRole && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: '#fff', fontWeight: 700, minWidth: 180 }}>Módulo</TableCell>
                {ALL_ACTIONS.map((action) => (
                  <TableCell key={action} align="center"
                    sx={{ color: '#fff', fontWeight: 700, minWidth: 90 }}>
                    {ACTION_LABELS[action]}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {MODULES.map((mod) => {
                const modulePerms = permMatrix[currentRoleId]?.[mod.key] || {};
                const viewEnabled = modulePerms.view !== false;

                return (
                  <TableRow key={mod.key} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{mod.label}</Typography>
                        {!viewEnabled && mod.actions.length > 1 && (
                          <Chip label="Sin acceso" size="small" color="default" sx={{ fontSize: 10 }} />
                        )}
                      </Box>
                    </TableCell>
                    {ALL_ACTIONS.map((action) => {
                      // Verificar si esta acción aplica al módulo
                      const actionExists = mod.actions.includes(action);
                      if (!actionExists) {
                        return (
                          <TableCell key={action} align="center">
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          </TableCell>
                        );
                      }

                      const isChecked = !!modulePerms[action];
                      // Deshabilitar acciones si "view" está desactivado (excepto "view" mismo)
                      const isDisabled = action !== 'view' && !viewEnabled;

                      return (
                        <TableCell key={action} align="center">
                          <Tooltip title={
                            isDisabled
                              ? 'Se requiere permiso de "Ver" para habilitar otras acciones'
                              : `${isChecked ? 'Desactivar' : 'Activar'} ${ACTION_LABELS[action]}`
                          }>
                            <span>
                              <Switch
                                size="small"
                                checked={isChecked}
                                disabled={isDisabled}
                                onChange={() => togglePermission(mod.key, action)}
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

      {/* Dialog de confirmación para restaurar */}
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

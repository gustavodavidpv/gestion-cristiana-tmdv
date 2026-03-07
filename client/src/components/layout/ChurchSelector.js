/**
 * ChurchSelector.js - Componente reutilizable para patrón SuperAdmin
 *
 * Encapsula el patrón "lista de iglesias primero" usado por SuperAdmin:
 * 1. SuperAdmin sin selección: muestra tabla de iglesias con botón "Ver"
 * 2. SuperAdmin con selección: muestra botón "Volver" + contenido del módulo
 * 3. Otros roles: renderiza el contenido directamente (sin selector)
 *
 * USO:
 * <ChurchSelector title="Miembros">
 *   {({ churchId, churchName, backButton }) => (
 *     <MiModulo churchId={churchId} churchName={churchName} backButton={backButton} />
 *   )}
 * </ChurchSelector>
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Box, Paper, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Chip,
  CircularProgress, Button,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  ArrowBack as ArrowBackIcon,
  Church as ChurchIcon,
} from '@mui/icons-material';

const ChurchSelector = ({ children, title }) => {
  const { isSuperAdmin } = useAuth();
  const [churches, setChurches] = useState([]);
  const [selectedChurch, setSelectedChurch] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cargar lista de iglesias (solo SuperAdmin)
  const loadChurches = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/churches');
      setChurches(data.churches || []);
    } catch (error) {
      console.error('Error al cargar iglesias:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin()) {
      loadChurches();
    }
  }, [isSuperAdmin, loadChurches]);

  // Si NO es SuperAdmin, renderizar contenido directamente
  if (!isSuperAdmin()) {
    return children({ churchId: null, churchName: null, backButton: null });
  }

  // SuperAdmin con iglesia seleccionada: mostrar botón volver + contenido
  if (selectedChurch) {
    const backButton = (
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => { setSelectedChurch(null); loadChurches(); }}
        sx={{ mb: 2 }}
      >
        Volver a lista de iglesias
      </Button>
    );

    return children({
      churchId: selectedChurch.id,
      churchName: selectedChurch.name,
      backButton,
    });
  }

  // SuperAdmin sin selección: mostrar tabla de iglesias
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <ChurchIcon color="primary" sx={{ fontSize: 28 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            Seleccione una iglesia para ver sus datos
          </Typography>
        </Box>
      </Box>

      {/* Tabla de iglesias */}
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Iglesia</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Responsable</TableCell>
                <TableCell align="center">Miembros</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {churches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    No hay iglesias registradas
                  </TableCell>
                </TableRow>
              ) : churches.map((church) => (
                <TableRow key={church.id} hover sx={{ cursor: 'pointer' }}
                  onClick={() => setSelectedChurch(church)}>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={14}>{church.name}</Typography>
                    {/* En móvil mostrar responsable debajo del nombre */}
                    {church.responsible && (
                      <Typography variant="caption" color="text.secondary"
                        sx={{ display: { sm: 'none' } }}>
                        {church.responsible}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {church.responsible || '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={church.membership_count || 0} size="small"
                      color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" title="Ver datos"
                      onClick={(e) => { e.stopPropagation(); setSelectedChurch(church); }}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default ChurchSelector;

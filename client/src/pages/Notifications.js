/**
 * Notifications.js - Módulo de Notificaciones WhatsApp
 * 
 * Permite al Administrador / Secretaría:
 * 1. Ver el estado de configuración de WhatsApp
 * 2. Configurar las horas de envío automático:
 *    - Recordatorio el DÍA ANTERIOR (ej: 6:00 PM)
 *    - Recordatorio el MISMO DÍA (ej: 7:00 AM)
 * 3. Ver los cultos próximos (7 días) con roles asignados
 * 4. Enviar notificaciones manualmente con un botón por culto
 * 
 * Los mensajes se envían al número +507 registrado en el miembro.
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  Box, Paper, Typography, Button, Grid, CircularProgress,
  Alert, Chip, Divider, Card, CardContent, CardActions,
  FormControl, InputLabel, Select, MenuItem, Switch,
  FormControlLabel, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Tooltip,
} from '@mui/material';
import {
  WhatsApp as WhatsAppIcon,
  Send as SendIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  NotificationsActive as NotifActiveIcon,
  NotificationsOff as NotifOffIcon,
  Refresh as RefreshIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material';

/**
 * Genera opciones de hora para los selectores (0-23).
 * Formato: "6:00 AM", "1:00 PM", etc.
 */
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const ampm = i >= 12 ? 'PM' : 'AM';
  const h12 = i % 12 || 12;
  return { value: i, label: `${h12}:00 ${ampm}` };
});

const Notifications = () => {
  // Estado de configuración WhatsApp
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Horarios programados
  const [schedule, setSchedule] = useState({
    notification_day_before_hour: 18,
    notification_same_day_hour: 7,
  });
  const [dayBeforeEnabled, setDayBeforeEnabled] = useState(true);
  const [sameDayEnabled, setSameDayEnabled] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Cultos próximos
  const [upcomingCultos, setUpcomingCultos] = useState([]);
  const [loadingCultos, setLoadingCultos] = useState(true);

  // Estado de envío por evento (eventId → 'sending' | 'sent' | 'error')
  const [sendingState, setSendingState] = useState({});

  // ===== CARGA INICIAL =====

  /** Carga el estado de configuración de WhatsApp */
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const { data } = await api.get('/notifications/status');
      setStatus(data);
    } catch (error) {
      console.error('Error al cargar estado WhatsApp:', error);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  /** Carga los horarios configurados de la iglesia */
  const loadSchedule = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/schedule');
      setSchedule({
        notification_day_before_hour: data.notification_day_before_hour ?? 18,
        notification_same_day_hour: data.notification_same_day_hour ?? 7,
      });
      setDayBeforeEnabled(data.notification_day_before_hour !== null);
      setSameDayEnabled(data.notification_same_day_hour !== null);
    } catch (error) {
      console.error('Error al cargar horario:', error);
    }
  }, []);

  /** Carga los cultos próximos (7 días) con roles asignados */
  const loadUpcomingCultos = useCallback(async () => {
    setLoadingCultos(true);
    try {
      const { data } = await api.get('/notifications/upcoming-cultos');
      setUpcomingCultos(data.cultos || []);
    } catch (error) {
      console.error('Error al cargar cultos próximos:', error);
    } finally {
      setLoadingCultos(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadSchedule();
    loadUpcomingCultos();
  }, [loadStatus, loadSchedule, loadUpcomingCultos]);

  // ===== GUARDAR HORARIO =====

  /** Guarda los horarios de notificación en la BD */
  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await api.put('/notifications/schedule', {
        notification_day_before_hour: dayBeforeEnabled ? schedule.notification_day_before_hour : null,
        notification_same_day_hour: sameDayEnabled ? schedule.notification_same_day_hour : null,
      });
      toast.success('Horario de notificaciones guardado');
    } catch (error) {
      toast.error('Error al guardar horario');
    } finally {
      setSavingSchedule(false);
    }
  };

  // ===== ENVÍO MANUAL =====

  /**
   * Envía notificación manual para un culto específico.
   * Muestra estado visual por cada botón (enviando → enviado/error).
   */
  const handleSendForEvent = async (eventId) => {
    setSendingState((prev) => ({ ...prev, [eventId]: 'sending' }));
    try {
      const { data } = await api.post(`/notifications/send/${eventId}`, { type: 'reminder' });
      setSendingState((prev) => ({ ...prev, [eventId]: 'sent' }));
      toast.success(data.message);
    } catch (error) {
      setSendingState((prev) => ({ ...prev, [eventId]: 'error' }));
      toast.error(error.response?.data?.message || 'Error al enviar notificación');
    }
  };

  // ===== FORMATO DE FECHA =====
  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-ES', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  /** Nombre completo del miembro, con indicador si no tiene teléfono */
  const memberLabel = (member) => {
    if (!member) return '—';
    const name = `${member.first_name} ${member.last_name}`;
    const hasPhone = !!member.phone;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2" fontSize={13}>{name}</Typography>
        {hasPhone ? (
          <Chip label={member.phone} size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
        ) : (
          <Chip label="Sin teléfono" size="small" color="warning" sx={{ fontSize: 10, height: 20 }} />
        )}
      </Box>
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WhatsAppIcon sx={{ fontSize: 32, color: '#25D366' }} />
          <Typography variant="h5" fontWeight={700}>Notificaciones WhatsApp</Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { loadStatus(); loadSchedule(); loadUpcomingCultos(); }}>
          Actualizar
        </Button>
      </Box>

      {/* ===== ESTADO DE CONFIGURACIÓN ===== */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Estado de Configuración
        </Typography>
        {loadingStatus ? (
          <CircularProgress size={24} />
        ) : status ? (
          <Alert
            severity={status.whatsapp_configured ? 'success' : 'warning'}
            icon={status.whatsapp_configured ? <CheckIcon /> : <ErrorIcon />}
          >
            {status.message}
          </Alert>
        ) : (
          <Alert severity="error">No se pudo verificar la configuración.</Alert>
        )}
      </Paper>

      <Grid container spacing={3}>
        {/* ===== PROGRAMACIÓN DE HORARIOS ===== */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ScheduleIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>
                Programación Automática
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Configure las horas en que se enviarán automáticamente los recordatorios a los miembros asignados a roles de culto (P, D, C).
            </Typography>

            {/* Recordatorio día anterior */}
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent sx={{ pb: 1 }}>
                <FormControlLabel
                  control={
                    <Switch checked={dayBeforeEnabled}
                      onChange={(e) => setDayBeforeEnabled(e.target.checked)}
                      color="primary" />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Recordatorio Día Anterior</Typography>
                      <Typography variant="caption" color="text.secondary">
                        "Mañana te corresponde Predicar/Dirigir/Cantar..."
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 1, ml: 0 }}
                />
                {dayBeforeEnabled && (
                  <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                    <InputLabel>Hora de envío</InputLabel>
                    <Select
                      value={schedule.notification_day_before_hour}
                      onChange={(e) => setSchedule({ ...schedule, notification_day_before_hour: e.target.value })}
                      label="Hora de envío"
                    >
                      {HOUR_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </CardContent>
            </Card>

            {/* Recordatorio mismo día */}
            <Card variant="outlined" sx={{ mb: 2.5 }}>
              <CardContent sx={{ pb: 1 }}>
                <FormControlLabel
                  control={
                    <Switch checked={sameDayEnabled}
                      onChange={(e) => setSameDayEnabled(e.target.checked)}
                      color="success" />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Recordatorio Mismo Día</Typography>
                      <Typography variant="caption" color="text.secondary">
                        "¡Hoy es el día! Te corresponde Predicar/Dirigir/Cantar..."
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 1, ml: 0 }}
                />
                {sameDayEnabled && (
                  <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                    <InputLabel>Hora de envío</InputLabel>
                    <Select
                      value={schedule.notification_same_day_hour}
                      onChange={(e) => setSchedule({ ...schedule, notification_same_day_hour: e.target.value })}
                      label="Hora de envío"
                    >
                      {HOUR_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </CardContent>
            </Card>

            {/* Botón guardar horario */}
            <Button
              variant="contained"
              fullWidth
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              startIcon={savingSchedule ? <CircularProgress size={18} color="inherit" /> : <ScheduleIcon />}
            >
              {savingSchedule ? 'Guardando...' : 'Guardar Horario'}
            </Button>

            {/* Resumen visual */}
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Resumen:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                {dayBeforeEnabled ? <NotifActiveIcon fontSize="small" color="primary" /> : <NotifOffIcon fontSize="small" color="disabled" />}
                <Typography variant="caption">
                  Día anterior: {dayBeforeEnabled ? HOUR_OPTIONS[schedule.notification_day_before_hour]?.label : 'Desactivado'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                {sameDayEnabled ? <NotifActiveIcon fontSize="small" color="success" /> : <NotifOffIcon fontSize="small" color="disabled" />}
                <Typography variant="caption">
                  Mismo día: {sameDayEnabled ? HOUR_OPTIONS[schedule.notification_same_day_hour]?.label : 'Desactivado'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* ===== CULTOS PRÓXIMOS ===== */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CampaignIcon color="secondary" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Cultos Próximos (7 días)
                </Typography>
              </Box>
              <Chip label={`${upcomingCultos.length} cultos`} size="small" color="primary" variant="outlined" />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Cultos con roles de predicación, dirección o cántico asignados. Puede enviar notificaciones manualmente con el botón "Enviar".
            </Typography>

            {loadingCultos ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : upcomingCultos.length === 0 ? (
              <Alert severity="info">
                No hay cultos con roles asignados en los próximos 7 días. Asigne roles (P, D, C) al crear o editar eventos tipo Culto.
              </Alert>
            ) : (
              <TableContainer sx={{ maxHeight: 420, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Culto</TableCell>
                      <TableCell>Predica (P)</TableCell>
                      <TableCell>Dirige (D)</TableCell>
                      <TableCell>Canta (C)</TableCell>
                      <TableCell align="center" sx={{ width: 100 }}>Enviar</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {upcomingCultos.map((culto) => {
                      const state = sendingState[culto.id];
                      return (
                        <TableRow key={culto.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600} fontSize={13}>
                              {culto.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(culto.start_date)}
                            </Typography>
                          </TableCell>
                          <TableCell>{memberLabel(culto.preacher)}</TableCell>
                          <TableCell>{memberLabel(culto.worship_leader)}</TableCell>
                          <TableCell>{memberLabel(culto.singer)}</TableCell>
                          <TableCell align="center">
                            {state === 'sending' ? (
                              <CircularProgress size={22} />
                            ) : state === 'sent' ? (
                              <Tooltip title="Notificación enviada">
                                <CheckIcon color="success" />
                              </Tooltip>
                            ) : state === 'error' ? (
                              <Tooltip title="Error al enviar. Intente de nuevo.">
                                <IconButton size="small" color="error" onClick={() => handleSendForEvent(culto.id)}>
                                  <ErrorIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Enviar notificación WhatsApp ahora">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleSendForEvent(culto.id)}
                                  disabled={!status?.whatsapp_configured}
                                >
                                  <SendIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* ===== INFORMACIÓN ADICIONAL ===== */}
      <Paper sx={{ p: 2.5, mt: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          ℹ️ Información sobre las notificaciones
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          • Los mensajes se envían al número con código <strong>+507</strong> registrado en cada miembro.
          <br />
          • Si un miembro no tiene teléfono registrado, la notificación se omite (no genera error).
          <br />
          • El sistema automático revisa cada hora si debe enviar notificaciones según las horas programadas.
          <br />
          • También puede enviar manualmente usando el botón <SendIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} /> en la tabla de cultos próximos.
          <br />
          • Para configurar WhatsApp, agregue <code>WHATSAPP_TOKEN</code> y <code>WHATSAPP_PHONE_NUMBER_ID</code> en las variables de entorno del servidor.
        </Typography>
      </Paper>
    </Box>
  );
};

export default Notifications;

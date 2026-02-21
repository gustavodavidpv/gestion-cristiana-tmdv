/**
 * Dashboard.js - Panel principal con estadísticas
 * 
 * Muestra: Contadores generales + Resumen de la iglesia
 * Las decisiones de fe se muestran como dato calculado (no editable)
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Box, Grid, Paper, Typography, CircularProgress, Divider,
} from '@mui/material';
import {
  People as PeopleIcon, Event as EventIcon,
  Description as DescriptionIcon, Favorite as FavoriteIcon,
} from '@mui/icons-material';

const StatCard = ({ icon, title, value, color }) => (
  <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, borderLeft: `4px solid ${color}` }}>
    <Box sx={{ bgcolor: `${color}15`, color, borderRadius: 2, p: 1.5, display: 'flex' }}>
      {icon}
    </Box>
    <Box>
      <Typography variant="h4" fontWeight={700}>{value}</Typography>
      <Typography variant="body2" color="text.secondary">{title}</Typography>
    </Box>
  </Paper>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ members: 0, events: 0, minutes: 0, church: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Cargar todas las estadísticas en paralelo
        const [membersRes, eventsRes, minutesRes] = await Promise.allSettled([
          api.get('/members', { params: { limit: 1 } }),
          api.get('/events', { params: { limit: 1 } }),
          api.get('/minutes', { params: { limit: 1 } }),
        ]);

        let church = null;
        if (user?.church_id) {
          try {
            const churchRes = await api.get(`/churches/${user.church_id}`);
            church = churchRes.data.church;
          } catch (e) { /* usuario sin acceso a la iglesia */ }
        }

        setStats({
          members: membersRes.status === 'fulfilled' ? membersRes.value.data.pagination.total : 0,
          events: eventsRes.status === 'fulfilled' ? eventsRes.value.data.pagination.total : 0,
          minutes: minutesRes.status === 'fulfilled' ? minutesRes.value.data.pagination.total : 0,
          church,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [user]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  const church = stats.church;

  return (
    <Box>
      {/* Bienvenida */}
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Bienvenido, {user?.full_name}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {user?.church?.name || 'Gestión Cristiana TMDV'}
      </Typography>

      {/* Tarjetas de estadísticas */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          <StatCard icon={<PeopleIcon />} title="Miembros" value={stats.members} color="#1565C0" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<EventIcon />} title="Eventos" value={stats.events} color="#E65100" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<DescriptionIcon />} title="Actas" value={stats.minutes} color="#6A1B9A" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<FavoriteIcon />} title={`Dec. Fe (${church?.faith_decisions_ref_year || new Date().getFullYear()})`}
            value={church?.faith_decisions_year || 0} color="#C62828" />
        </Grid>
      </Grid>

      {/* Resumen de la iglesia */}
      {church && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Resumen de la Iglesia</Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {[
              { label: 'Responsable de la Obra', value: church.responsible || '-' },
              { label: 'Membresía', value: church.membership_count },
              { label: 'Asistencia Promedio Semanal', value: church.avg_weekly_attendance },
              { label: 'Predicadores Ordenados', value: church.ordained_preachers },
              { label: 'Predicadores No Ordenados', value: church.unordained_preachers },
              { label: 'Diáconos Ordenados', value: church.ordained_deacons },
              { label: 'Diáconos No Ordenados', value: church.unordained_deacons },
            ].map((item) => (
              <Grid item xs={6} sm={4} md={3} key={item.label}>
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                <Typography variant="h6" fontWeight={600}>{item.value}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default Dashboard;

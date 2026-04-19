/**
 * Dashboard.js - Panel principal con estadísticas
 *
 * DOS MODOS:
 *
 * 1. SUPERADMIN: Dashboard consolidado con estadísticas de TODAS las iglesias
 *    - Filtro de año (afecta eventos, actas, decisiones de fe, asistencia promedio)
 *    - Tarjetas resumen con totales
 *    - Gráficas ApexCharts comparativas por iglesia
 *
 * 2. ADMIN/OTROS: Dashboard original sin cambios
 *    - Contadores generales + Resumen de la iglesia
 *    - Las decisiones de fe se muestran como dato calculado (no editable)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Box, Grid, Paper, Typography, CircularProgress, Divider,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  People as PeopleIcon, Event as EventIcon,
  Description as DescriptionIcon, Favorite as FavoriteIcon,
  TrendingUp as TrendingUpIcon, Church as ChurchIcon,
} from '@mui/icons-material';
import Chart from 'react-apexcharts';

// ========================================================
// COMPONENTE COMPARTIDO: Tarjeta de estadística
// ========================================================
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

// ========================================================
// DASHBOARD REGULAR (Admin, Secretaría, Líder, Visitante)
// Código original sin cambios
// ========================================================
const RegularDashboard = ({ user }) => {
  // Año actual y listado de años disponibles para el selector (últimos 5 años)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Año seleccionado: por defecto el año actual (cumple requisito del filtro)
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // summary: viene del endpoint ligero /churches/my/summary?year=YYYY
  //   → accesible para cualquier rol con permiso `dashboard.view`.
  // church: viene de /churches/:id (solo si el rol tiene `churches.view`)
  //   → se usa para el bloque "Resumen de la Iglesia".
  const [stats, setStats] = useState({ members: 0, events: 0, minutes: 0, church: null, summary: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        // Cargar contadores generales y resumen del año en paralelo.
        // Usamos Promise.allSettled para que una caída parcial no rompa el dashboard.
        const [membersRes, eventsRes, minutesRes, summaryRes] = await Promise.allSettled([
          api.get('/members', { params: { limit: 1 } }),
          api.get('/events', { params: { limit: 1 } }),
          api.get('/minutes', { params: { limit: 1 } }),
          // Nuevo endpoint: devuelve decisiones de fe del año seleccionado
          // protegido por `dashboard.view`, no requiere `churches.view`.
          api.get('/churches/my/summary', { params: { year: selectedYear } }),
        ]);

        // Resumen anual de la iglesia (decisiones de fe, etc.) — puede fallar
        // si el usuario no tiene permiso `dashboard.view` (no debería, pero safe).
        const summary = summaryRes.status === 'fulfilled' ? summaryRes.value.data : null;

        // Datos extendidos de la iglesia: solo disponibles si el rol tiene `churches.view`.
        // Si falla (403), se ignora silenciosamente y no se muestra "Resumen de la Iglesia".
        let church = null;
        if (user?.church_id) {
          try {
            const churchRes = await api.get(`/churches/${user.church_id}`);
            church = churchRes.data.church;
          } catch (e) { /* usuario sin acceso a la iglesia — se omite el bloque */ }
        }

        setStats({
          members: membersRes.status === 'fulfilled' ? membersRes.value.data.pagination.total : 0,
          events: eventsRes.status === 'fulfilled' ? eventsRes.value.data.pagination.total : 0,
          minutes: minutesRes.status === 'fulfilled' ? minutesRes.value.data.pagination.total : 0,
          church,
          summary,
        });
      } catch (error) {
        // Fallback general ante errores inesperados
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [user, selectedYear]); // recarga cuando cambia el año seleccionado

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  const church = stats.church;
  const summary = stats.summary;

  // Valor de decisiones de fe: prioriza el resumen dinámico del año seleccionado.
  // Si el endpoint no respondió, cae al campo almacenado en la iglesia (solo coincide con año actual).
  const faithDecisionsValue = summary?.faith_decisions ?? church?.faith_decisions_year ?? 0;
  const faithDecisionsYear = summary?.year ?? church?.faith_decisions_ref_year ?? selectedYear;

  return (
    <Box>
      {/* Header con bienvenida + selector de año */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Bienvenido, {user?.full_name}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {user?.church?.name || 'Gestión Cristiana TMDV'}
          </Typography>
        </Box>
        {/* Selector de año — por defecto año actual, permite consultar años anteriores */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Año</InputLabel>
          <Select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} label="Año">
            {yearOptions.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {/* Tarjetas de estadísticas
          Mobile (xs): 1 tarjeta completa por fila (xs={12}) → evita que se vean descuadradas.
          Tablet (sm): 2 por fila. Desktop (md): 4 por fila. */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<PeopleIcon />} title="Miembros" value={stats.members} color="#1565C0" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<EventIcon />} title="Eventos" value={stats.events} color="#E65100" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<DescriptionIcon />} title="Actas" value={stats.minutes} color="#6A1B9A" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {/* Decisiones de fe del año seleccionado — ahora visible para cualquier rol
              con permiso `dashboard.view`, aunque no tenga `churches.view`. */}
          <StatCard
            icon={<FavoriteIcon />}
            title={`Dec. Fe (${faithDecisionsYear})`}
            value={faithDecisionsValue}
            color="#C62828"
          />
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

// ========================================================
// DASHBOARD SUPERADMIN con gráficas comparativas
// ========================================================

/** Opciones base compartidas para todas las gráficas */
const baseChartOptions = {
  chart: {
    toolbar: { show: false },
    fontFamily: 'Segoe UI, system-ui, Roboto, sans-serif',
  },
  dataLabels: { enabled: true, style: { fontSize: '12px' } },
  tooltip: { theme: 'light' },
  grid: { borderColor: '#f0f0f0' },
};

const SuperAdminDashboard = ({ user }) => {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar estadísticas del endpoint consolidado
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/churches/stats/dashboard', {
        params: { year: selectedYear },
      });
      setStats(data.stats || []);
    } catch (error) {
      console.error('Error loading SuperAdmin stats:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Preparar datos para las gráficas
  const churchNames = stats.map((s) => s.name);

  // Totales para las stat cards
  const totals = stats.reduce((acc, s) => ({
    members: acc.members + s.membership_count,
    events: acc.events + s.events_count,
    minutes: acc.minutes + s.minutes_count,
    faithDecisions: acc.faithDecisions + s.faith_decisions,
  }), { members: 0, events: 0, minutes: 0, faithDecisions: 0 });

  return (
    <Box>
      {/* Header con bienvenida y filtro de año */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Dashboard General
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Bienvenido, {user?.full_name} — Estadísticas de todas las iglesias
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Año</InputLabel>
          <Select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} label="Año">
            {yearOptions.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {/* Tarjetas de totales
          Mobile (xs): 1 por fila (card completa) → se ve ordenada en celulares.
          Tablet (sm): 2 por fila. Desktop (md): 4 por fila. */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<PeopleIcon />} title="Total Miembros" value={totals.members} color="#1565C0" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<EventIcon />} title={`Eventos (${selectedYear})`} value={totals.events} color="#E65100" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<DescriptionIcon />} title={`Actas (${selectedYear})`} value={totals.minutes} color="#6A1B9A" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<FavoriteIcon />} title={`Dec. Fe (${selectedYear})`} value={totals.faithDecisions} color="#C62828" />
        </Grid>
      </Grid>

      {/* Gráficas comparativas por iglesia */}
      <Grid container spacing={3}>
        {/* Gráfica 1: Miembros por Iglesia (NO filtrada por año) */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PeopleIcon color="primary" fontSize="small" />
              <Typography variant="h6" fontSize={{ xs: 14, sm: 16 }}>Miembros por Iglesia</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Chart
              type="bar"
              height={Math.max(250, churchNames.length * 40)}
              options={{
                ...baseChartOptions,
                plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
                xaxis: { categories: churchNames },
                colors: ['#1565C0'],
                yaxis: { labels: { style: { fontSize: '12px' } } },
              }}
              series={[{ name: 'Miembros', data: stats.map((s) => s.membership_count) }]}
            />
          </Paper>
        </Grid>

        {/* Gráfica 2: Eventos y Actas por Iglesia (filtrada por año) */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <EventIcon sx={{ color: '#E65100' }} fontSize="small" />
              <Typography variant="h6" fontSize={{ xs: 14, sm: 16 }}>
                Eventos y Actas ({selectedYear})
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Chart
              type="bar"
              height={Math.max(250, churchNames.length * 40)}
              options={{
                ...baseChartOptions,
                plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '50%' } },
                xaxis: { categories: churchNames },
                colors: ['#E65100', '#6A1B9A'],
                yaxis: { labels: { style: { fontSize: '12px' } } },
                legend: { position: 'top', fontSize: '12px' },
              }}
              series={[
                { name: 'Eventos', data: stats.map((s) => s.events_count) },
                { name: 'Actas', data: stats.map((s) => s.minutes_count) },
              ]}
            />
          </Paper>
        </Grid>

        {/* Gráfica 3: Decisiones de Fe por Iglesia (filtrada por año) */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <FavoriteIcon sx={{ color: '#C62828' }} fontSize="small" />
              <Typography variant="h6" fontSize={{ xs: 14, sm: 16 }}>
                Decisiones de Fe ({selectedYear})
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Chart
              type="bar"
              height={Math.max(250, churchNames.length * 40)}
              options={{
                ...baseChartOptions,
                plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
                xaxis: { categories: churchNames },
                colors: ['#C62828'],
                yaxis: { labels: { style: { fontSize: '12px' } } },
              }}
              series={[{ name: 'Decisiones de Fe', data: stats.map((s) => s.faith_decisions) }]}
            />
          </Paper>
        </Grid>

        {/* Gráfica 4: Asistencia Promedio Semanal por Iglesia (filtrada por año) */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TrendingUpIcon sx={{ color: '#2E7D32' }} fontSize="small" />
              <Typography variant="h6" fontSize={{ xs: 14, sm: 16 }}>
                Asistencia Promedio Semanal ({selectedYear})
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Chart
              type="bar"
              height={Math.max(250, churchNames.length * 40)}
              options={{
                ...baseChartOptions,
                plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
                xaxis: { categories: churchNames },
                colors: ['#2E7D32'],
                yaxis: { labels: { style: { fontSize: '12px' } } },
              }}
              series={[{ name: 'Promedio Semanal', data: stats.map((s) => s.avg_weekly_attendance) }]}
            />
          </Paper>
        </Grid>

        {/* Gráfica 5: Predicadores y Diáconos por Iglesia (NO filtrada por año) */}
        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <ChurchIcon color="primary" fontSize="small" />
              <Typography variant="h6" fontSize={{ xs: 14, sm: 16 }}>
                Predicadores y Diáconos por Iglesia
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Chart
              type="bar"
              height={Math.max(300, churchNames.length * 45)}
              options={{
                ...baseChartOptions,
                plotOptions: {
                  bar: { horizontal: true, borderRadius: 3, barHeight: '65%', stacked: true },
                },
                chart: { ...baseChartOptions.chart, stacked: true },
                xaxis: { categories: churchNames },
                colors: ['#1565C0', '#42A5F5', '#2E7D32', '#66BB6A'],
                legend: { position: 'top', fontSize: '12px' },
                yaxis: { labels: { style: { fontSize: '12px' } } },
              }}
              series={[
                { name: 'Pred. Ordenados', data: stats.map((s) => s.ordained_preachers) },
                { name: 'Pred. No Ordenados', data: stats.map((s) => s.unordained_preachers) },
                { name: 'Diác. Ordenados', data: stats.map((s) => s.ordained_deacons) },
                { name: 'Diác. No Ordenados', data: stats.map((s) => s.unordained_deacons) },
              ]}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

// ========================================================
// COMPONENTE PRINCIPAL: Detecta rol y renderiza el dashboard apropiado
// ========================================================
const Dashboard = () => {
  const { user, isSuperAdmin } = useAuth();

  if (isSuperAdmin()) {
    return <SuperAdminDashboard user={user} />;
  }

  return <RegularDashboard user={user} />;
};

export default Dashboard;

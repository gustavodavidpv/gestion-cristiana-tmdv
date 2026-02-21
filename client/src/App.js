/**
 * App.js - Componente raíz con layout principal
 * 
 * Layout: Sidebar (Drawer MUI) + Navbar (AppBar) + Contenido
 * Routing: React Router v6 con rutas protegidas por rol
 * Responsive: Drawer temporal en móvil, permanente en desktop
 */
import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useAuth } from './context/AuthContext';
import './styles/index.css';

// Layout
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Churches from './pages/Churches';
import Events from './pages/Events';
import Minutes from './pages/Minutes';
import Users from './pages/Users';
import WeeklyAttendance from './pages/WeeklyAttendance';

const DRAWER_WIDTH = 260;

/** Componente para rutas protegidas por rol */
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role?.name)) return <Navigate to="/dashboard" />;
  return children;
};

function App() {
  const { user, loading } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  // Pantalla de carga inicial
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2 }}>
        <CircularProgress size={48} />
        <Typography color="text.secondary">Cargando Gestión Cristiana - TMDV...</Typography>
      </Box>
    );
  }

  // Si no autenticado → Login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  // Layout principal: Sidebar + Navbar + Contenido
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Sidebar
        drawerWidth={DRAWER_WIDTH}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isMobile={isMobile}
      />

      {/* Contenido principal */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', ml: { md: `${DRAWER_WIDTH}px` } }}>
        {/* Navbar superior */}
        <Navbar
          drawerWidth={DRAWER_WIDTH}
          onMenuClick={() => setMobileOpen(true)}
          isMobile={isMobile}
        />

        {/* Área de contenido con padding responsive */}
        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, mt: '64px' }}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/members" element={
              <ProtectedRoute roles={['Administrador', 'Secretaría', 'Líder', 'Visitante']}><Members /></ProtectedRoute>
            } />
            <Route path="/churches" element={
              <ProtectedRoute roles={['Administrador', 'Secretaría']}><Churches /></ProtectedRoute>
            } />
            <Route path="/events" element={
              <ProtectedRoute roles={['Administrador', 'Secretaría', 'Líder']}><Events /></ProtectedRoute>
            } />
            <Route path="/attendance" element={
              <ProtectedRoute roles={['Administrador', 'Secretaría', 'Líder']}><WeeklyAttendance /></ProtectedRoute>
            } />
            <Route path="/minutes" element={
              <ProtectedRoute roles={['Administrador', 'Secretaría']}><Minutes /></ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute roles={['Administrador']}><Users /></ProtectedRoute>
            } />
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}

export default App;

import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useAuth } from './context/AuthContext';
import './styles/index.css';

import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Churches from './pages/Churches';
import Events from './pages/Events';
import Minutes from './pages/Minutes';
import Users from './pages/Users';
import WeeklyAttendance from './pages/WeeklyAttendance';
import MinisterialPositions from './pages/MinisterialPositions';
import Branding from './pages/Branding';
import Notifications from './pages/Notifications';
import Permissions from './pages/Permissions';
import Roles from './pages/Roles';

const DRAWER_WIDTH = 260;

const ProtectedRoute = ({ children, module, superAdminOnly = false }) => {
  const { user, loading, canViewModule, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (superAdminOnly && !isSuperAdmin()) return <Navigate to="/dashboard" />;
  if (module && !canViewModule(module)) return <Navigate to="/dashboard" />;

  return children;
};

function App() {
  const { user, loading } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={48} />
        <Typography color="text.secondary">Cargando Gestion Cristiana - TMDV...</Typography>
      </Box>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar
        drawerWidth={DRAWER_WIDTH}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isMobile={isMobile}
      />

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', ml: { md: `${DRAWER_WIDTH}px` } }}>
        <Navbar
          drawerWidth={DRAWER_WIDTH}
          onMenuClick={() => setMobileOpen(true)}
          isMobile={isMobile}
        />

        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, mt: '64px' }}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/members"
              element={<ProtectedRoute module="members"><Members /></ProtectedRoute>}
            />
            <Route
              path="/churches"
              element={<ProtectedRoute module="churches"><Churches /></ProtectedRoute>}
            />
            <Route
              path="/events"
              element={<ProtectedRoute module="events"><Events /></ProtectedRoute>}
            />
            <Route
              path="/attendance"
              element={<ProtectedRoute module="weekly_attendance"><WeeklyAttendance /></ProtectedRoute>}
            />
            <Route
              path="/minutes"
              element={<ProtectedRoute module="minutes"><Minutes /></ProtectedRoute>}
            />
            <Route
              path="/positions"
              element={<ProtectedRoute module="positions"><MinisterialPositions /></ProtectedRoute>}
            />
            <Route
              path="/branding"
              element={<ProtectedRoute module="branding"><Branding /></ProtectedRoute>}
            />
            <Route
              path="/notifications"
              element={<ProtectedRoute module="notifications"><Notifications /></ProtectedRoute>}
            />
            <Route
              path="/users"
              element={<ProtectedRoute module="users"><Users /></ProtectedRoute>}
            />
            <Route
              path="/roles"
              element={<ProtectedRoute superAdminOnly><Roles /></ProtectedRoute>}
            />
            <Route
              path="/permissions"
              element={<ProtectedRoute superAdminOnly><Permissions /></ProtectedRoute>}
            />
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}

export default App;

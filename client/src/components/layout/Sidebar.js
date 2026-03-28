/**
 * Sidebar.js - Navegación lateral con MUI Drawer
 * 
 * CAMBIOS v2:
 * - SuperAdmin ve todo (bypass en hasRole)
 * - Nuevos menús: Cargos Ministeriales, Branding
 * - Iglesia visible para Admin también (su propia iglesia)
 */
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Drawer, Box, Typography, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Divider, Avatar,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Church as ChurchIcon,
  Event as EventIcon,
  Description as DescriptionIcon,
  AdminPanelSettings as AdminIcon,
  Groups as GroupsIcon,
  Badge as BadgeIcon,
  Palette as PaletteIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material';

/** Definición de menú con roles permitidos.
 *  SuperAdmin ve todo (hasRole retorna true automáticamente).
 */
const menuItems = [
  { path: '/dashboard', icon: <DashboardIcon />, label: 'Dashboard', roles: ['Administrador', 'Secretaría', 'Líder', 'Visitante'] },
  { path: '/members', icon: <PeopleIcon />, label: 'Miembros', roles: ['Administrador', 'Secretaría', 'Líder', 'Visitante'] },
  { path: '/churches', icon: <ChurchIcon />, label: 'Iglesias', roles: ['Administrador', 'Secretaría'] },
  { path: '/events', icon: <EventIcon />, label: 'Eventos', roles: ['Administrador', 'Secretaría', 'Líder'] },
  { path: '/attendance', icon: <GroupsIcon />, label: 'Asistencia', roles: ['Administrador', 'Secretaría', 'Líder'] },
  { path: '/minutes', icon: <DescriptionIcon />, label: 'Actas', roles: ['Administrador', 'Secretaría'] },
  { path: '/notifications', icon: <WhatsAppIcon />, label: 'Notificaciones', roles: ['Administrador', 'Secretaría'] },
  { path: '/positions', icon: <BadgeIcon />, label: 'Cargos', roles: ['Administrador'] },
  { path: '/branding', icon: <PaletteIcon />, label: 'Branding', roles: ['Administrador'] },
  { path: '/users', icon: <AdminIcon />, label: 'Usuarios', roles: ['Administrador'] },
];

/**
 * Construye la URL completa de un archivo subido al servidor.
 * Patrón reutilizado de Branding.js para cargar logos de iglesia.
 * @param {string|null} path - Ruta relativa del archivo (ej: "/uploads/logos/logo-church-1.png")
 * @returns {string|null} URL completa o null si no hay path
 */
const getFileUrl = (path) => {
  if (!path) return null;
  const base = process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace('/api', '')
    : '';
  return `${base}${path}`;
};

const Sidebar = ({ drawerWidth, mobileOpen, onClose, isMobile }) => {
  const { user, hasRole } = useAuth();
  const location = useLocation();

  // Filtrar items de menú según rol del usuario
  const visibleItems = menuItems.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header — Logo/nombre/iniciales dinámicos de la iglesia del usuario */}
      <Box sx={{
        p: 3, textAlign: 'center',
        background: 'linear-gradient(180deg, #0D47A1, #1a237e)',
      }}>
        {/* Logo de la iglesia (desde branding) o emoji ⛪ como fallback */}
        {user?.church?.login_logo_url ? (
          <Avatar
            src={getFileUrl(user.church.login_logo_url)}
            alt={user?.church?.name || 'Iglesia'}
            sx={{ width: 52, height: 52, mx: 'auto', mb: 0.5, bgcolor: 'rgba(255,255,255,0.15)' }}
            imgProps={{ onError: (e) => { e.target.style.display = 'none'; } }}
          >
            ⛪
          </Avatar>
        ) : (
          <Typography variant="h4" sx={{ mb: 0.5 }}>⛪</Typography>
        )}
        {/* Nombre de la iglesia (dinámico) o "Gestión Cristiana" como fallback */}
        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.3 }}>
          {user?.church?.name || 'Gestión Cristiana'}
        </Typography>
        {/* Iniciales de la iglesia (editables desde módulo Iglesias) o "TMDV" como fallback */}
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 2 }}>
          {user?.church?.initials || 'TMDV'}
        </Typography>
      </Box>

      <Divider />

      {/* Lista de navegación */}
      <List sx={{ flex: 1, px: 1, py: 1.5 }}>
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={NavLink}
                to={item.path}
                onClick={isMobile ? onClose : undefined}
                sx={{
                  borderRadius: 2,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.75)',
                  bgcolor: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                  '&:hover': {
                    bgcolor: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 700 : 500 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      {/* Footer con info del usuario */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 36, height: 36, fontSize: 14 }}>
          {user?.full_name?.charAt(0)?.toUpperCase()}
        </Avatar>
        <Box sx={{ overflow: 'hidden' }}>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.full_name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            {user?.role?.name}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  const drawerSx = {
    '& .MuiDrawer-paper': {
      width: drawerWidth,
      boxSizing: 'border-box',
      background: 'linear-gradient(180deg, #0D47A1, #1a237e)',
      borderRight: 'none',
      color: '#fff',
    },
  };

  return (
    <>
      {isMobile && (
        <Drawer variant="temporary" open={mobileOpen} onClose={onClose} sx={drawerSx} ModalProps={{ keepMounted: true }}>
          {drawerContent}
        </Drawer>
      )}
      {!isMobile && (
        <Drawer variant="permanent" open sx={drawerSx}>
          {drawerContent}
        </Drawer>
      )}
    </>
  );
};

export default Sidebar;

/**
 * Sidebar.js - Navegación lateral con MUI Drawer
 * 
 * - En desktop (md+): Drawer permanente fijo a la izquierda
 * - En móvil (<md): Drawer temporal que se abre con menú hamburguesa
 * - Menú dinámico filtrado por rol del usuario
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
} from '@mui/icons-material';

/** Definición de menú con roles permitidos */
const menuItems = [
  { path: '/dashboard', icon: <DashboardIcon />, label: 'Dashboard', roles: ['Administrador', 'Secretaría', 'Líder', 'Visitante'] },
  { path: '/members', icon: <PeopleIcon />, label: 'Miembros', roles: ['Administrador', 'Secretaría', 'Líder', 'Visitante'] },
  { path: '/churches', icon: <ChurchIcon />, label: 'Iglesia', roles: ['Administrador', 'Secretaría'] },
  { path: '/events', icon: <EventIcon />, label: 'Eventos', roles: ['Administrador', 'Secretaría', 'Líder'] },
  { path: '/attendance', icon: <GroupsIcon />, label: 'Asistencia', roles: ['Administrador', 'Secretaría', 'Líder'] },
  { path: '/minutes', icon: <DescriptionIcon />, label: 'Actas', roles: ['Administrador', 'Secretaría'] },
  { path: '/users', icon: <AdminIcon />, label: 'Usuarios', roles: ['Administrador'] },
];

const Sidebar = ({ drawerWidth, mobileOpen, onClose, isMobile }) => {
  const { user, hasRole } = useAuth();
  const location = useLocation();

  // Filtrar items de menú según rol del usuario
  const visibleItems = menuItems.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  /** Contenido del drawer (compartido entre móvil y desktop) */
  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header con logo e identidad */}
      <Box sx={{
        p: 3, textAlign: 'center',
        background: 'linear-gradient(180deg, #0D47A1, #1a237e)',
      }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>⛪</Typography>
        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
          Gestión Cristiana
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 2 }}>
          TMDV
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

  // Estilos compartidos del drawer
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
      {/* Drawer TEMPORAL para móvil */}
      {isMobile && (
        <Drawer variant="temporary" open={mobileOpen} onClose={onClose} sx={drawerSx} ModalProps={{ keepMounted: true }}>
          {drawerContent}
        </Drawer>
      )}

      {/* Drawer PERMANENTE para desktop */}
      {!isMobile && (
        <Drawer variant="permanent" open sx={drawerSx}>
          {drawerContent}
        </Drawer>
      )}
    </>
  );
};

export default Sidebar;

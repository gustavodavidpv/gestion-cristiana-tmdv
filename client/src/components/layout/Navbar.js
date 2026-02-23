/**
 * Navbar.js - Barra superior con MUI AppBar
 * 
 * - Muestra nombre de la iglesia del usuario
 * - Botón de menú hamburguesa en móvil
 * - Info del usuario y botón de cerrar sesión
 */
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  AppBar, Toolbar, Typography, IconButton, Button, Box, Chip,
} from '@mui/material';
import { Menu as MenuIcon, Logout as LogoutIcon, Person as PersonIcon } from '@mui/icons-material';

const Navbar = ({ drawerWidth, onMenuClick, isMobile }) => {
  const { user, logout, isSuperAdmin } = useAuth();

  /**
   * Título del NavBar:
   * - SuperAdmin: muestra "Gestión Cristiana - TMDV" (no está ligado a una iglesia específica)
   * - Admin/otros: muestra el nombre de la iglesia del usuario
   */
  const navTitle = isSuperAdmin()
    ? 'Gestión Cristiana - TMDV'
    : (user?.church?.name || 'Gestión Cristiana - TMDV');

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { md: `calc(100% - ${drawerWidth}px)` },
        ml: { md: `${drawerWidth}px` },
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar>
        {/* Botón hamburguesa solo en móvil */}
        {isMobile && (
          <IconButton edge="start" onClick={onMenuClick} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
        )}

        {/* Título: nombre de la iglesia o genérico para SuperAdmin */}
        <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontSize: { xs: 14, sm: 18 } }}>
          {navTitle}
        </Typography>

        {/* Info del usuario */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<PersonIcon />}
            label={isMobile ? user?.full_name?.split(' ')[0] : user?.full_name}
            variant="outlined"
            size="small"
            sx={{ display: { xs: 'none', sm: 'flex' } }}
          />
          <Button
            startIcon={<LogoutIcon />}
            onClick={logout}
            size="small"
            color="inherit"
            sx={{ fontSize: 13 }}
          >
            {isMobile ? '' : 'Salir'}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;

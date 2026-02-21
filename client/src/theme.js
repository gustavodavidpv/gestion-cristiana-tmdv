/**
 * theme.js - Configuración del tema MUI para Gestión Cristiana TMDV
 * 
 * Paleta principal: Azul (#1565C0) y Blanco
 * Tipografía: Segoe UI / system fonts
 * Estilo: Clean, profesional, moderno
 */
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1565C0',
      dark: '#0D47A1',
      light: '#42A5F5',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#2E7D32',
      dark: '#1B5E20',
      light: '#66BB6A',
    },
    error: {
      main: '#C62828',
    },
    warning: {
      main: '#E65100',
    },
    info: {
      main: '#1565C0',
    },
    success: {
      main: '#2E7D32',
    },
    background: {
      default: '#F5F7FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#212121',
      secondary: '#616161',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // No uppercase en botones
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: '#F5F7FA',
          color: '#424242',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
  },
});

export default theme;

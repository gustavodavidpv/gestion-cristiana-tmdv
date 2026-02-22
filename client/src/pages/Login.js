/**
 * Login.js - Página de autenticación con branding dinámico por iglesia
 * 
 * FLUJO DE BRANDING:
 * 1. Al cargar, intenta obtener branding de la iglesia principal (id=1)
 *    usando el endpoint PÚBLICO GET /api/branding/:churchId
 * 2. Si hay múltiples iglesias, muestra selector y carga branding dinámicamente
 * 3. Logo y título cambian según la iglesia seleccionada
 * 
 * Modos: 'login' → 'forgot' → 'reset'
 * En desarrollo: el código de reset se muestra en un toast
 * En producción: se enviaría por email (requiere configurar servicio)
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  Box, Paper, Typography, TextField, Button, Link,
  CircularProgress, Alert,
} from '@mui/material';
import { Church as ChurchIcon } from '@mui/icons-material';

/** Construye URL completa para archivos estáticos (logos subidos) */
const getFileUrl = (path) => {
  if (!path) return null;
  // En desarrollo el backend corre en :5000, en producción mismo origen
  const base = process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace('/api', '')
    : '';
  return `${base}${path}`;
};

const Login = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  // === Estado de branding dinámico ===
  const [branding, setBranding] = useState({
    title: 'Gestión Cristiana',
    subtitle: 'TMDV',
    logoUrl: null,
  });

  // ===== CARGAR BRANDING DE LA IGLESIA PRINCIPAL =====
  useEffect(() => {
    /**
     * Intenta cargar el branding de la primera iglesia (id=1).
     * El endpoint GET /api/branding/:churchId es PÚBLICO (no requiere auth).
     * Si falla, se mantiene el branding por defecto.
     */
    const loadBranding = async () => {
      try {
        // Intentar con iglesia id=1 (la principal creada por el seed)
        const { data } = await api.get('/branding/1');
        if (data.branding) {
          setBranding({
            title: data.branding.login_title || data.branding.name || 'Gestión Cristiana',
            subtitle: 'TMDV',
            logoUrl: data.branding.login_logo_url || null,
          });
        }
      } catch {
        // Si falla (iglesia no existe o error de red), usar branding por defecto
        // No mostramos error al usuario porque es cosmético
      }
    };
    loadBranding();
  }, []);

  // ===== HANDLERS DE AUTENTICACIÓN =====
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('¡Bienvenido!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      toast.success('Código generado');
      if (data.reset_code) {
        toast.info(`Código (modo desarrollo): ${data.reset_code}`, { autoClose: 15000 });
      }
      setMode('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al procesar solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, code: resetCode, new_password: newPassword });
      toast.success('Contraseña restablecida exitosamente');
      setMode('login');
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al restablecer contraseña');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => { setMode('login'); setError(''); };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0D47A1 0%, #1a237e 100%)', p: 2,
    }}>
      <Paper elevation={8} sx={{ width: '100%', maxWidth: 420, p: 4, borderRadius: 3 }}>
        {/* ===== HEADER CON BRANDING DINÁMICO ===== */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          {/* Logo: usa el de la iglesia si existe, sino el icono por defecto */}
          {branding.logoUrl ? (
            <Box sx={{ mb: 1 }}>
              <img
                src={getFileUrl(branding.logoUrl)}
                alt="Logo iglesia"
                style={{
                  maxWidth: 80, maxHeight: 80,
                  borderRadius: 8,
                  objectFit: 'contain',
                }}
                onError={(e) => {
                  // Si la imagen falla, ocultar y mostrar icono por defecto
                  e.target.style.display = 'none';
                }}
              />
            </Box>
          ) : (
            <ChurchIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          )}

          {/* Título dinámico (nombre personalizado de la iglesia) */}
          <Typography variant="h5" fontWeight={700} color="primary.dark">
            {branding.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 2 }}>
            {branding.subtitle}
          </Typography>
        </Box>

        {/* Error alert */}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {/* ===== LOGIN ===== */}
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <TextField fullWidth label="Correo electrónico" type="email" required margin="normal" size="small"
              value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <TextField fullWidth label="Contraseña" type="password" required margin="normal" size="small"
              value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ mt: 2, py: 1.2 }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Iniciar Sesión'}
            </Button>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link component="button" variant="body2" onClick={() => setMode('forgot')} underline="hover">
                ¿Olvidó su contraseña?
              </Link>
            </Box>
          </form>
        )}

        {/* ===== FORGOT ===== */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <Alert severity="info" sx={{ mb: 2 }}>Ingrese su correo para recibir un código de restablecimiento.</Alert>
            <TextField fullWidth label="Correo electrónico" type="email" required margin="normal" size="small"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ mt: 2, py: 1.2 }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Enviar Código'}
            </Button>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link component="button" variant="body2" onClick={goBack} underline="hover">Volver al inicio de sesión</Link>
            </Box>
          </form>
        )}

        {/* ===== RESET ===== */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword}>
            <Alert severity="info" sx={{ mb: 2 }}>Ingrese el código y su nueva contraseña.</Alert>
            <TextField fullWidth label="Código de verificación" required margin="normal" size="small"
              value={resetCode} onChange={(e) => setResetCode(e.target.value)} inputProps={{ maxLength: 6 }} />
            <TextField fullWidth label="Nueva contraseña" type="password" required margin="normal" size="small"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} inputProps={{ minLength: 6 }} />
            <TextField fullWidth label="Confirmar contraseña" type="password" required margin="normal" size="small"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ mt: 2, py: 1.2 }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Restablecer Contraseña'}
            </Button>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link component="button" variant="body2" onClick={goBack} underline="hover">Volver al inicio de sesión</Link>
            </Box>
          </form>
        )}
      </Paper>
    </Box>
  );
};

export default Login;

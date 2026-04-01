import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(null); // Permisos dinámicos del usuario

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * Carga los permisos del usuario autenticado desde el backend.
   * Se llama después de loadUser y login para tener permisos actualizados.
   */
  const loadPermissions = async () => {
    try {
      const { data } = await api.get('/auth/my-permissions');
      setPermissions(data.permissions);
    } catch {
      // Si falla, los permisos quedan null y hasPermission retornará false
      setPermissions(null);
    }
  };

  const loadUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      // Cargar permisos después de autenticar
      await loadPermissions();
    } catch (error) {
      localStorage.removeItem('token');
      setUser(null);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    // Cargar permisos después del login
    await loadPermissions();
    return data;
  };

  const register = async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setPermissions(null);
  };

  /** Verifica si el usuario tiene alguno de los roles indicados */
  const hasRole = (...roles) => {
    if (!user || !user.role) return false;
    // SuperAdmin siempre tiene acceso (bypass)
    if (user.role.name === 'SuperAdmin') return true;
    return roles.includes(user.role.name);
  };

  /** Verifica si el usuario es SuperAdmin */
  const isSuperAdmin = () => {
    return user && user.role && user.role.name === 'SuperAdmin';
  };

  /**
   * Verifica si el usuario tiene un permiso específico (módulo + acción).
   * SuperAdmin siempre retorna true.
   * Usa los permisos cargados desde GET /api/auth/my-permissions.
   *
   * @param {string} module - Clave del módulo (ej: 'members', 'events')
   * @param {string} action - Acción (ej: 'view', 'create', 'edit', 'delete', 'attendance')
   * @returns {boolean}
   */
  const hasPermission = (module, action) => {
    if (!user || !user.role) return false;
    if (user.role.name === 'SuperAdmin') return true;
    return permissions?.[module]?.[action] ?? false;
  };

  /** Shorthand: verifica si el usuario puede ver un módulo */
  const canViewModule = (module) => hasPermission(module, 'view');

  return (
    <AuthContext.Provider value={{
      user, loading, permissions, login, register, logout,
      hasRole, isSuperAdmin, hasPermission, canViewModule, loadUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};

export default AuthContext;

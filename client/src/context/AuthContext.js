import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
    } catch (error) {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, hasRole, isSuperAdmin, loadUser }}>
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

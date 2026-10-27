import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('fcip_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('fcip_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncUser = async () => {
      const savedToken = localStorage.getItem('fcip_token');
      if (savedToken) {
        try {
          const res = await authService.getProfile();
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('fcip_user', JSON.stringify(res.user));
          }
        } catch {
          logout();
        }
      }
      setLoading(false);
    };

    syncUser();

    const handleAuthChange = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('authChange', handleAuthChange);
    return () => window.removeEventListener('authChange', handleAuthChange);
  }, []);

  const login = (authToken, userData) => {
    localStorage.setItem('fcip_token', authToken);
    localStorage.setItem('fcip_user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('fcip_token');
    localStorage.removeItem('fcip_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

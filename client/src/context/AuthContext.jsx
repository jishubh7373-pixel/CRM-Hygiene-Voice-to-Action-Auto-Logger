import React, { createContext, useContext, useState, useEffect } from 'react';
import ApiClient from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const token = ApiClient.getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const res = await ApiClient.get('/auth/me');
      if (res.success && res.data) {
        setUser(res.data.user);
        setOrganization(res.data.organization);
      }
    } catch (err) {
      console.warn('Failed to restore session:', err.message);
      ApiClient.clearTokens();
      setUser(null);
      setOrganization(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email, password) => {
    const res = await ApiClient.post('/auth/login', { email, password });
    if (res.success && res.data) {
      ApiClient.setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
      setUser(res.data.user);
      setOrganization(res.data.organization);
      return res.data;
    }
    throw new Error(res.message || 'Login failed');
  };

  const logout = async () => {
    try {
      await ApiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      ApiClient.clearTokens();
      setUser(null);
      setOrganization(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

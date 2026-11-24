import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, username: string, password: string, phone: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  openAuthModal: (tab?: 'login' | 'register') => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TOKEN_KEY = 'voltro_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Session expired');
        })
        .then((data) => {
          setUser(data.user);
        })
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'ورود ناموفق بود.' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      setIsAuthModalOpen(false);
      return { success: true };
    } catch {
      return { success: false, error: 'خطا در برقراری ارتباط با سرور.' };
    }
  };

  const register = async (name: string, username: string, password: string, phone: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'ثبت‌نام ناموفق بود.' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      setIsAuthModalOpen(false);
      return { success: true };
    } catch {
      return { success: false, error: 'خطا در برقراری ارتباط با سرور.' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
  };

  const openAuthModal = (tab: 'login' | 'register' = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

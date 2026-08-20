import { createContext, useEffect, useState, type ReactNode } from 'react';
import {
  getAccessToken,
  setAccessToken,
  setAuthFailureHandler,
} from '../services/api';
import * as authService from '../services/auth.service';
import type { AuthUser, LoginRequest } from '../types';

export interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setToken] = useState<string | null>(getAccessToken());
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = () => {
    setAccessToken(null);
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    setAuthFailureHandler(clearAuth);
    void authService
      .refresh()
      .then(({ user: refreshedUser, accessToken: refreshedToken }) => {
        setUser(refreshedUser);
        setToken(refreshedToken);
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => setIsLoading(false));

    return () => setAuthFailureHandler(null);
  }, []);

  const handleLogin = async (credentials: LoginRequest): Promise<void> => {
    const result = await authService.login(credentials);
    setUser(result.user);
    setToken(result.accessToken);
  };

  const handleLogout = async (): Promise<void> => {
    await authService.logout();
    setUser(null);
    setToken(null);
  };

  const handleRefresh = async (): Promise<void> => {
    const result = await authService.refresh();
    setUser(result.user);
    setToken(result.accessToken);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: user !== null && accessToken !== null,
        isLoading,
        login: handleLogin,
        logout: handleLogout,
        refresh: handleRefresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

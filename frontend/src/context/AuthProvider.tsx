import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  fetchCurrentUser,
  login as loginRequest,
  refreshToken as refreshRequest,
  register as registerRequest,
} from '../api';
import { setAuthToken } from '../api/client';
import type {
  AuthTokens,
  AuthUser,
  RefreshResponse,
  RegisterPayload,
  UserResponse,
} from '../types';
import { AuthContext, type AuthContextValue, type LoginArgs } from './AuthContext';

const STORAGE_KEY = 'eventum_auth_tokens';

const persistTokens = (tokens: AuthTokens | null) => {
  if (!tokens) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
};

const readPersistedTokens = (): AuthTokens | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthTokens;
  } catch (error) {
    console.warn('Не удалось прочитать сохранённые токены', error);
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyTokens = useCallback((nextTokens: AuthTokens | null) => {
    setTokens(nextTokens);
    persistTokens(nextTokens);
    setAuthToken(nextTokens?.access ?? null);
  }, []);

  const handleAuthSuccess = useCallback((data: UserResponse) => {
    applyTokens({ access: data.access, refresh: data.refresh });
    setUser(data.user);
  }, [applyTokens]);

  const restoreSession = useCallback(async () => {
    const stored = readPersistedTokens();
    if (!stored) {
      applyTokens(null);
      setIsLoading(false);
      return;
    }

    applyTokens(stored);
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Не удалось восстановить сессию', error);
      applyTokens(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [applyTokens]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async ({ email, password }: LoginArgs) => {
    const response = await loginRequest({ username: email, password });
    handleAuthSuccess(response);
  }, [handleAuthSuccess]);

  const register = useCallback(async (payload: RegisterPayload) => {
    await registerRequest(payload);
    await login({ email: payload.email, password: payload.password });
  }, [login]);

  const logout = useCallback(() => {
    setUser(null);
    applyTokens(null);
  }, [applyTokens]);

  const refresh = useCallback(async () => {
    if (!tokens?.refresh) return;
    const freshTokens: RefreshResponse = await refreshRequest(tokens.refresh);
    const merged: AuthTokens = {
      access: freshTokens.access,
      refresh: freshTokens.refresh ?? tokens.refresh,
    };
    applyTokens(merged);
  }, [applyTokens, tokens]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    tokens,
    isLoading,
    login,
    register,
    logout,
    refresh,
  }), [user, tokens, isLoading, login, register, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

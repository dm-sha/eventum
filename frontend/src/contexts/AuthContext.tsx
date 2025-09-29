import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getDevUser } from '../api/event';
import { getCookie, setCookie, deleteCookie, getMerupCookieOptions } from '../utils/cookies';

export interface User {
  id: number;
  vk_id: number;
  name: string;
  avatar_url: string;
  email: string;
  date_joined: string;
  last_login: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  login: (tokens: AuthTokens, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Проверяем, нужно ли пропускать авторизацию в режиме разработки
const shouldSkipAuth = import.meta.env.VITE_SKIP_AUTH === 'true' && import.meta.env.DEV;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Если включен режим пропуска авторизации, получаем пользователя разработчика из базы
    if (shouldSkipAuth) {
      const setupDevAuth = async () => {
        try {
          // Получаем реального пользователя разработчика из базы данных
          const devAuth = await getDevUser();
          
          const tokens = {
            access: devAuth.access,
            refresh: devAuth.refresh
          };
          
          setUser(devAuth.user);
          setTokens(tokens);
          
          // Сохраняем токены в localStorage для API клиента
          localStorage.setItem('auth_tokens', JSON.stringify(tokens));
          localStorage.setItem('auth_user', JSON.stringify(devAuth.user));
          
          // Небольшая задержка, чтобы дать время API клиенту обновиться
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('Ошибка авторизации пользователя разработчика:', error);
          alert('Ошибка авторизации пользователя разработчика. Убедитесь, что пользователь с vk_id=999999999 создан в базе данных.');
        } finally {
          setIsLoading(false);
        }
      };
      
      setupDevAuth();
      return;
    }

    // Проверяем, есть ли сохраненные данные аутентификации
    const userAgent = navigator.userAgent;
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    
    // Сначала пробуем получить из localStorage (для локальной разработки)
    let savedTokens = localStorage.getItem('auth_tokens');
    let savedUser = localStorage.getItem('auth_user');
    
    // Если на поддомене merup.ru и нет данных в localStorage, пробуем cookies
    if ((!savedTokens || !savedUser) && window.location.hostname.includes('merup.ru')) {
      savedTokens = getCookie('auth_tokens');
      savedUser = getCookie('auth_user');
    }
    
    // Fallback для мобильных устройств: пробуем sessionStorage
    if (!savedTokens || !savedUser) {
      savedTokens = savedTokens || sessionStorage.getItem('auth_tokens');
      savedUser = savedUser || sessionStorage.getItem('auth_user');
    }
    
    // Специальная логика для Safari: пробуем все доступные источники
    if ((!savedTokens || !savedUser) && isSafari) {
      console.log('[AuthContext] Safari detected, trying all token sources...');
      
      const tokenSources = [
        () => localStorage.getItem('auth_tokens'),
        () => sessionStorage.getItem('auth_tokens'),
        () => getCookie('auth_tokens'),
        () => getCookie('auth_tokens_alt'),
      ];
      
      const userSources = [
        () => localStorage.getItem('auth_user'),
        () => sessionStorage.getItem('auth_user'),
        () => getCookie('auth_user'),
        () => getCookie('auth_user_alt'),
      ];
      
      for (const getToken of tokenSources) {
        try {
          const token = getToken();
          if (token) {
            savedTokens = token;
            console.log('[AuthContext] Safari: Found tokens');
            break;
          }
        } catch (e) {
          console.log('[AuthContext] Safari: Error getting tokens:', e);
        }
      }
      
      for (const getUser of userSources) {
        try {
          const user = getUser();
          if (user) {
            savedUser = user;
            console.log('[AuthContext] Safari: Found user');
            break;
          }
        } catch (e) {
          console.log('[AuthContext] Safari: Error getting user:', e);
        }
      }
    }

    if (savedTokens && savedUser) {
      try {
        const parsedTokens = JSON.parse(savedTokens);
        const parsedUser = JSON.parse(savedUser);
        
        // Проверяем, что токены валидны
        if (parsedTokens.access && parsedUser.id) {
          setTokens(parsedTokens);
          setUser(parsedUser);
        } else {
          localStorage.removeItem('auth_tokens');
          localStorage.removeItem('auth_user');
        }
      } catch (error) {
        console.error('Error parsing saved auth data:', error);
        localStorage.removeItem('auth_tokens');
        localStorage.removeItem('auth_user');
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = (newTokens: AuthTokens, newUser: User) => {
    setTokens(newTokens);
    setUser(newUser);
    
    const userAgent = navigator.userAgent;
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    
    // Сохраняем в localStorage для локальной разработки
    localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    
    // Сохраняем в sessionStorage для мобильных устройств
    sessionStorage.setItem('auth_tokens', JSON.stringify(newTokens));
    sessionStorage.setItem('auth_user', JSON.stringify(newUser));
    
    // Сохраняем в cookies для работы с поддоменами
    const cookieOptions = getMerupCookieOptions();
    setCookie('auth_tokens', JSON.stringify(newTokens), cookieOptions);
    setCookie('auth_user', JSON.stringify(newUser), cookieOptions);
    
    // Для Safari дополнительно сохраняем в альтернативных cookies
    if (isSafari) {
      console.log('[AuthContext] Safari: Saving auth data in multiple locations');
      try {
        setCookie('auth_tokens_alt', JSON.stringify(newTokens), {
          ...cookieOptions,
          samesite: 'lax' // Используем lax для альтернативного cookie
        });
        setCookie('auth_user_alt', JSON.stringify(newUser), {
          ...cookieOptions,
          samesite: 'lax'
        });
      } catch (e) {
        console.warn('[AuthContext] Safari: Failed to set alternative cookies:', e);
      }
    }
  };

  const logout = () => {
    setTokens(null);
    setUser(null);
    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_tokens');
    sessionStorage.removeItem('auth_user');
    
    // Очищаем cookies
    const cookieOptions = getMerupCookieOptions();
    deleteCookie('auth_tokens', cookieOptions);
    deleteCookie('auth_user', cookieOptions);
    
    // Для Safari также очищаем альтернативные cookies
    const userAgent = navigator.userAgent;
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    if (isSafari) {
      try {
        deleteCookie('auth_tokens_alt', cookieOptions);
        deleteCookie('auth_user_alt', cookieOptions);
      } catch (e) {
        console.warn('[AuthContext] Safari: Failed to delete alternative cookies:', e);
      }
    }
  };

  const isAuthenticated = !!user && !!tokens && !!tokens.access;

  return (
    <AuthContext.Provider value={{
      user,
      tokens,
      login,
      logout,
      isAuthenticated,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

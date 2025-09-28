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
    // Сначала пробуем получить из localStorage (для локальной разработки)
    let savedTokens = localStorage.getItem('auth_tokens');
    let savedUser = localStorage.getItem('auth_user');
    
    // Если на поддомене merup.ru и нет данных в localStorage, пробуем cookies
    if ((!savedTokens || !savedUser) && window.location.hostname.includes('merup.ru')) {
      savedTokens = getCookie('auth_tokens');
      savedUser = getCookie('auth_user');
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
    
    // Сохраняем в localStorage для локальной разработки
    localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    
    // Сохраняем в cookies для работы с поддоменами
    const cookieOptions = getMerupCookieOptions();
    setCookie('auth_tokens', JSON.stringify(newTokens), cookieOptions);
    setCookie('auth_user', JSON.stringify(newUser), cookieOptions);
  };

  const logout = () => {
    setTokens(null);
    setUser(null);
    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_user');
    
    // Очищаем cookies
    const cookieOptions = getMerupCookieOptions();
    deleteCookie('auth_tokens', cookieOptions);
    deleteCookie('auth_user', cookieOptions);
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

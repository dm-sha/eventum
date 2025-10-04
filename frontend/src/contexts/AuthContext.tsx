import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi } from '../api/eventumApi';
import { TokenManager } from '../api/apiClient';
import { getCookie, setCookie, getMerupCookieOptions } from '../utils/cookies';

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
          const response = await authApi.getDevUser();
          const devAuth = response.data;
          
          const tokens = {
            access: devAuth.access,
            refresh: devAuth.refresh
          };
          
          setUser(devAuth.user);
          setTokens(tokens);
          
          // Используем TokenManager для сохранения токенов
          TokenManager.saveTokens(tokens);
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
    const savedTokens = TokenManager.getTokens();
    const savedUser = localStorage.getItem('auth_user') || 
                      sessionStorage.getItem('auth_user') || 
                      getCookie('auth_user');

    if (savedTokens && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        
        // Проверяем, что данные валидны
        if (savedTokens.access && parsedUser.id && typeof parsedUser.id === 'number') {
          setTokens(savedTokens);
          setUser(parsedUser);
        } else {
          // Очищаем поврежденные данные
          TokenManager.clearTokens();
        }
      } catch (error) {
        console.error('Error parsing saved auth data:', error);
        TokenManager.clearTokens();
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = (newTokens: AuthTokens, newUser: User) => {
    setTokens(newTokens);
    setUser(newUser);
    
    // Используем TokenManager для сохранения токенов
    TokenManager.saveTokens(newTokens);
    
    // Сохраняем пользователя в разных хранилищах
    const userString = JSON.stringify(newUser);
    localStorage.setItem('auth_user', userString);
    sessionStorage.setItem('auth_user', userString);
    
    const cookieOptions = getMerupCookieOptions();
    setCookie('auth_user', userString, cookieOptions);
  };

  const logout = () => {
    setTokens(null);
    setUser(null);
    
    // Используем TokenManager для очистки токенов
    TokenManager.clearTokens();
    
    // Очищаем все хранилища данных пользователя
    localStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_user');
    
    // Перенаправляем на главную страницу merup.ru с формой аутентификации
    window.location.href = 'https://merup.ru';
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

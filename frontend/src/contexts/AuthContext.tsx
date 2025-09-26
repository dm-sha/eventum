import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Проверяем, есть ли сохраненные данные аутентификации
    const savedTokens = localStorage.getItem('auth_tokens');
    const savedUser = localStorage.getItem('auth_user');

    if (savedTokens && savedUser) {
      try {
        setTokens(JSON.parse(savedTokens));
        setUser(JSON.parse(savedUser));
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
    localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
    localStorage.setItem('auth_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setTokens(null);
    setUser(null);
    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_user');
  };

  const isAuthenticated = !!user && !!tokens;

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

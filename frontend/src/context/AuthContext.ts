import { createContext } from 'react';
import type { AuthTokens, AuthUser, RegisterPayload } from '../types';

export type LoginArgs = {
  email: string;
  password: string;
};

export type AuthContextValue = {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  login: (args: LoginArgs) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

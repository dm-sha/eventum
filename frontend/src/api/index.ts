// Новый унифицированный API
export * from './eventumApi';
export * from './apiClient';

// Старые API файлы для обратной совместимости
export * from './eventum';
export * from './participant';
export * from './event';
export * from './group';
export * from './eventTag';
export * from './eventWave';
export * from './organizers';
export * from './location';

// Экспортируем только типы из auth.ts, чтобы избежать конфликта с authApi из eventumApi
export type { AuthTokens, VKAuthRequest, VKAuthResponse, RefreshTokenRequest, RefreshTokenResponse } from './auth';
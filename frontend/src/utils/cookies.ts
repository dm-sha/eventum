/**
 * Утилиты для работы с cookies
 */

/**
 * Получить значение cookie по имени
 */
export const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

/**
 * Установить cookie
 */
export const setCookie = (name: string, value: string, options: {
  domain?: string;
  path?: string;
  secure?: boolean;
  samesite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  expires?: Date;
} = {}): void => {
  const {
    domain,
    path = '/',
    secure = window.location.protocol === 'https:',
    samesite = 'lax',
    maxAge,
    expires
  } = options;

  let cookieString = `${name}=${value}`;
  
  if (domain) cookieString += `; domain=${domain}`;
  if (path) cookieString += `; path=${path}`;
  if (secure) cookieString += `; secure`;
  if (samesite) cookieString += `; samesite=${samesite}`;
  if (maxAge !== undefined) cookieString += `; max-age=${maxAge}`;
  if (expires) cookieString += `; expires=${expires.toUTCString()}`;

  document.cookie = cookieString;
};

/**
 * Удалить cookie
 */
export const deleteCookie = (name: string, options: {
  domain?: string;
  path?: string;
} = {}): void => {
  const { domain, path = '/' } = options;
  
  let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  if (domain) cookieString += `; domain=${domain}`;
  if (path) cookieString += `; path=${path}`;

  document.cookie = cookieString;
};

/**
 * Получить настройки cookie для домена merup.ru
 */
export const getMerupCookieOptions = () => {
  const isMerupDomain = window.location.hostname.includes('merup.ru');
  const isSecure = window.location.protocol === 'https:';
  
  return {
    domain: isMerupDomain ? '.merup.ru' : undefined,
    path: '/',
    secure: isSecure,  // Зависит от протокола, не всегда true
    samesite: (isSecure ? 'lax' : 'none') as 'lax' | 'none'  // none для HTTP, lax для HTTPS
  };
};

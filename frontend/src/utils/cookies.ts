/**
 * Утилиты для работы с cookies
 */

/**
 * Получить значение cookie по имени
 */
export const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    if (cookieValue) {
      try {
        // Декодируем значение cookie
        return decodeURIComponent(cookieValue);
      } catch (error) {
        return cookieValue; // Возвращаем как есть, если декодирование не удалось
      }
    }
  }
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

  // Проверяем размер cookie (обычно лимит 4KB)
  const cookieSize = `${name}=${value}`.length;
  if (cookieSize > 4000) {
    console.warn(`[Cookie] Cookie ${name} is too large (${cookieSize} bytes), may be truncated`);
  }

  // Кодируем значение для безопасности
  const encodedValue = encodeURIComponent(value);
  
  let cookieString = `${name}=${encodedValue}`;
  
  if (domain) cookieString += `; domain=${domain}`;
  if (path) cookieString += `; path=${path}`;
  if (secure) cookieString += `; secure`;
  if (samesite) cookieString += `; samesite=${samesite}`;
  if (maxAge !== undefined) cookieString += `; max-age=${maxAge}`;
  if (expires) cookieString += `; expires=${expires.toUTCString()}`;

  try {
    document.cookie = cookieString;
  } catch (error) {
    console.error(`[Cookie] Failed to set cookie ${name}:`, error);
  }
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
  const hostname = window.location.hostname;
  const isMerupDomain = hostname === 'merup.ru' || hostname.endsWith('.merup.ru');
  const isSecure = window.location.protocol === 'https:';
  const userAgent = navigator.userAgent;
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
  
  
  // Для Safari нужны специальные настройки
  if (isSafari) {
    return {
      domain: isMerupDomain ? '.merup.ru' : undefined,
      path: '/',
      secure: isSecure,  // Safari требует secure=true для SameSite=None
      samesite: isSecure ? 'none' : 'lax' as 'lax' | 'none'  // none только для HTTPS в Safari
    };
  }
  
  return {
    domain: isMerupDomain ? '.merup.ru' : undefined,
    path: '/',
    secure: isSecure,
    samesite: (isSecure ? 'lax' : 'none') as 'lax' | 'none'
  };
};

/**
 * Упрощенные утилиты для работы с API и eventum
 */

const LOCALHOSTS = new Set(['localhost', '127.0.0.1']);
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'admin', 'mail', 'ftp', 'cdn', 'static']);

/**
 * Проверяет, является ли hostname localhost
 */
export const isLocalhost = (hostname: string): boolean => {
  return LOCALHOSTS.has(hostname.toLowerCase());
};

/**
 * Получает базовый домен
 */
export const getBaseDomain = (): string => {
  const host = window.location.hostname.toLowerCase();
  
  if (isLocalhost(host)) {
    return host;
  }

  // Для продакшена возвращаем merup.ru
  return 'merup.ru';
};

/**
 * Получает slug из поддомена
 */
export const getSubdomainSlug = (): string | null => {
  const host = window.location.hostname.toLowerCase();
  const baseDomain = getBaseDomain();

  // Если это localhost, поддоменов нет
  if (isLocalhost(host)) {
    return null;
  }

  // Если это основной домен
  if (host === baseDomain) {
    return null;
  }

  // Проверяем, что это поддомен базового домена
  if (!host.endsWith(`.${baseDomain}`)) {
    return null;
  }

  const subdomain = host.slice(0, host.length - baseDomain.length - 1);
  
  // Проверяем, что это не зарезервированный поддомен
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return null;
  }

  return subdomain;
};

/**
 * Определяет, нужно ли использовать поддомены для роутинга
 */
export const shouldUseSubdomainRouting = (): boolean => {
  return !isLocalhost(window.location.hostname) && 
         import.meta.env.VITE_DISABLE_SUBDOMAIN_ROUTING !== 'true';
};

/**
 * Создает URL для eventum с учетом поддоменов
 */
export const getEventumUrl = (slug: string, path: string = '/'): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (shouldUseSubdomainRouting()) {
    const protocol = window.location.protocol;
    const baseDomain = getBaseDomain();
    return `${protocol}//${slug}.${baseDomain}${normalizedPath}`;
  }

  return `/${slug}${normalizedPath === '/' ? '' : normalizedPath}`;
};

/**
 * Создает путь с учетом текущего контекста (поддомен или обычный путь)
 */
export const getEventumScopedPath = (slug: string, path: string = '/'): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Если мы на поддомене, не добавляем slug в путь
  if (getSubdomainSlug()) {
    return normalizedPath;
  }
  
  return `/${slug}${normalizedPath === '/' ? '' : normalizedPath}`;
};

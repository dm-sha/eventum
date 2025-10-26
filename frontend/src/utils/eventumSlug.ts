const LOCALHOSTS = new Set(['localhost', '127.0.0.1']);

const getReservedSubdomains = (): Set<string> => {
  const reserved = new Set(['www']);
  const envReserved = import.meta.env.VITE_RESERVED_SUBDOMAINS;
  if (envReserved) {
    envReserved
      .split(',')
      .map((item: string) => item.trim().toLowerCase())
      .filter(Boolean)
      .forEach((item: string) => reserved.add(item));
  }
  return reserved;
};

export const isLocalHostName = (hostname: string): boolean => {
  return LOCALHOSTS.has(hostname.toLowerCase());
};

export const getBaseDomain = (): string => {
  const envDomain = import.meta.env.VITE_BASE_DOMAIN?.toLowerCase();
  if (envDomain) {
    return envDomain;
  }

  const host = window.location.hostname.toLowerCase();
  if (isLocalHostName(host)) {
    return host;
  }

  const parts = host.split('.');
  if (parts.length <= 2) {
    return host;
  }

  return parts.slice(-2).join('.');
};

export const getSubdomainSlug = (): string | null => {
  const host = window.location.hostname.toLowerCase();
  const baseDomain = getBaseDomain();

  if (host === baseDomain) {
    return null;
  }

  if (!host.endsWith(`.${baseDomain}`)) {
    return null;
  }

  const candidate = host.slice(0, host.length - baseDomain.length - 1);
  if (!candidate) {
    return null;
  }

  const reserved = getReservedSubdomains();
  if (reserved.has(candidate)) {
    return null;
  }

  return candidate;
};

export const shouldUseSubdomainRouting = (): boolean => {
  const host = window.location.hostname.toLowerCase();
  if (isLocalHostName(host)) {
    return false;
  }

  if (import.meta.env.VITE_DISABLE_SUBDOMAIN_ROUTING === 'true') {
    return false;
  }

  return true;
};

const normalizePath = (path: string): string => {
  if (!path || path === '/') {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
};

export const getEventumUrl = (slug: string, path: string = '/'): string => {
  const targetPath = normalizePath(path);

  if (shouldUseSubdomainRouting()) {
    const protocol = window.location.protocol;
    const baseDomain = getBaseDomain();
    const suffix = targetPath === '/' ? '/' : targetPath;
    return `${protocol}//${slug}.${baseDomain}${suffix}`;
  }

  const suffix = targetPath === '/' ? '' : targetPath;
  return `/${slug}${suffix}`;
};

export const getEventumScopedPath = (slug: string, path: string = '/'): string => {
  const targetPath = normalizePath(path);
  const suffix = targetPath === '/' ? '/' : targetPath;

  // Если мы на поддомене, не добавляем slug в путь
  if (getSubdomainSlug()) {
    return suffix;
  }

  return `/${slug}${suffix === '/' ? '' : suffix}`;
};

export const getApplicationBaseUrl = (): string => {
  if (shouldUseSubdomainRouting()) {
    const protocol = window.location.protocol;
    const baseDomain = getBaseDomain();
    return `${protocol}//${baseDomain}`;
  }

  return window.location.origin;
};

export const getApiUrl = (slug: string, path: string = ''): string => {
  const baseUrl = getApiBaseUrl();
  
  // Если мы на поддомене, не добавляем slug в путь API
  if (getSubdomainSlug()) {
    return `${baseUrl}${path}`;
  }
  
  // Если не на поддомене, добавляем slug в путь
  return `${baseUrl}/eventums/${slug}${path}`;
};

export const shouldUseSubdomainApi = (): boolean => {
  const hostname = window.location.hostname;
  
  // Используем поддомен API только если мы на поддомене merup.ru
  // И API запрос идет к тому же поддомену (локальная разработка)
  return hostname.endsWith('.merup.ru') && import.meta.env.DEV;
};

export const shouldUseContainerApi = (): boolean => {
  const hostname = window.location.hostname;
  
  // Используем API если мы на основном домене или на поддомене merup.ru
  return hostname === 'api.merup.ru' || 
         hostname === 'merup.ru' ||
         (hostname.endsWith('.merup.ru') && !import.meta.env.DEV);
};

const getApiBaseUrl = (): string => {
  // В режиме разработки используем локальный бекенд
  if (import.meta.env.DEV) {
    return 'http://localhost:8000/api';
  }
  // В продакшене используем переменную окружения или fallback на продакшн URL
  return import.meta.env.VITE_API_BASE_URL || 'https://api.merup.ru/api';
};

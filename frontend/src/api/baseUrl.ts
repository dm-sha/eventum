const DEFAULT_REMOTE_API = 'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api';
const LOCAL_API = 'http://localhost:8000/api';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const normalizeBaseUrl = (rawUrl: string): string => {
  const value = rawUrl.trim();
  if (!value) {
    throw new Error('Empty base URL');
  }

  const hasExplicitScheme = /^https?:\/\//i.test(value);
  const candidate = hasExplicitScheme ? value : `https://${value}`;
  const url = new URL(candidate);

  url.search = '';
  url.hash = '';

  if (!LOCAL_HOSTS.has(url.hostname)) {
    url.protocol = 'https:';
  } else if (!hasExplicitScheme) {
    url.protocol = 'http:';
  }

  const path = trimTrailingSlash(url.pathname);
  const normalisedPath = path === '/' ? '' : path;

  return `${url.origin}${normalisedPath}`;
};

const resolveEnvBaseUrl = (): string | null => {
  const envValue = import.meta.env.VITE_API_BASE_URL;
  if (!envValue) {
    return null;
  }

  try {
    return normalizeBaseUrl(envValue);
  } catch (error) {
    console.error('Invalid VITE_API_BASE_URL value, falling back to defaults:', error);
    return null;
  }
};

export const resolveApiBaseUrl = (): string => {
  if (import.meta.env.DEV) {
    return LOCAL_API;
  }

  const resolvedEnvUrl = resolveEnvBaseUrl();

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    if (hostname.endsWith('.merup.ru') || hostname === 'merup.ru') {
      return normalizeBaseUrl(DEFAULT_REMOTE_API);
    }

    if (LOCAL_HOSTS.has(hostname)) {
      if (resolvedEnvUrl) {
        return resolvedEnvUrl;
      }

      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const candidate = `${protocol}//${window.location.host}/api`;
      return normalizeBaseUrl(candidate);
    }

    if (resolvedEnvUrl) {
      return resolvedEnvUrl;
    }
  }

  return resolvedEnvUrl ?? normalizeBaseUrl(DEFAULT_REMOTE_API);
};

export default resolveApiBaseUrl;

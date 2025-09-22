import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ??
  'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api';

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

export default apiClient;

import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

export default apiClient;

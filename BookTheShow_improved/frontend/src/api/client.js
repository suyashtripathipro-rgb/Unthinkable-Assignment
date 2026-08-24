import axios from 'axios';

export const API_BASE    = import.meta.env.VITE_API_URL    || 'http://localhost:4000/api';
export const SOCKET_BASE = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

const client = axios.create({ baseURL: API_BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('bts_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: auto-logout on 401
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bts_token');
      localStorage.removeItem('bts_user');
      // Don't force redirect here — let AuthContext handle it
    }
    return Promise.reject(err);
  }
);

export default client;

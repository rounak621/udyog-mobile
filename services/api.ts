import axios from 'axios';

const API_BASE_URL = 'https://api.udyogbook.in/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

let _authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  _authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const getAuthToken = () => _authToken;

// Interceptor: always inject latest token
api.interceptors.request.use(
  (config) => {
    if (_authToken) {
      config.headers['Authorization'] = `Bearer ${_authToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

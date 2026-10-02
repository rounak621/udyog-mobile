import axios from 'axios';
import * as Application from 'expo-application';

const PROD_URL = 'https://api.udyogbook.in/api/v1';
const STAGING_URL = 'https://staging-api.udyogbook.in/api/v1';

/**
 * Returns the correct API base URL for the running build.
 *
 * Rules:
 *   applicationId === "com.udyog.udyogmobile" AND !isDev  → production URL
 *   anything else (staging build OR dev mode)              → staging URL
 *
 * @param applicationId - value of Application.applicationId at runtime
 * @param isDev         - value of __DEV__
 */
export function resolveApiBaseUrl(
  applicationId: string | null,
  isDev: boolean,
): string {
  if (applicationId === 'com.udyog.udyogmobile' && !isDev) {
    return PROD_URL;
  }
  return STAGING_URL;
}

/**
 * Returns the deep-link scheme for the running build.
 *   com.udyog.udyogmobile         → "udyog"
 *   com.udyog.udyogmobile.staging → "udyog-staging"
 */
export function getAppScheme(applicationId: string | null): string {
  if (applicationId?.endsWith('.staging')) {
    return 'udyog-staging';
  }
  return 'udyog';
}

export const APP_SCHEME = getAppScheme(Application.applicationId);

export const API_BASE_URL = resolveApiBaseUrl(Application.applicationId, __DEV__);

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
  (error) => Promise.reject(error),
);

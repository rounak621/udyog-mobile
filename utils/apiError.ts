import { Alert } from 'react-native';

/**
 * Extracts a user-friendly error message from an API error response,
 * following the established pattern across Udyog mobile screens:
 * checks `err.response?.data?.detail` first, handles FastAPI array details,
 * network failures, and falls back to a descriptive default message.
 */
export function getApiErrorMessage(err: any, fallbackMessage = 'An unexpected error occurred'): string {
  if (!err) {
    return fallbackMessage;
  }

  // Network offline / unreachable error
  if (err.code === 'ERR_NETWORK' || err.message === 'Network Error' || (err.isAxiosError && !err.response)) {
    return 'Network error. Please check your internet connection and try again.';
  }

  // Timeout error
  if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
    return 'Request timed out. Please check your connection and try again.';
  }

  // FastAPI detail field (can be string or array of validation errors)
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim().length > 0) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item: any) => (typeof item === 'string' ? item : item?.msg || JSON.stringify(item)))
      .join(', ');
  }

  // Generic message field
  const message = err.response?.data?.message;
  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  // Fallback to error message if present and meaningful
  if (typeof err.message === 'string' && err.message.trim().length > 0 && !err.message.includes('[object Object]')) {
    return err.message;
  }

  return fallbackMessage;
}

/**
 * Displays an Alert dialog with the extracted API error message.
 */
export function showApiError(
  err: any,
  fallbackMessage = 'An unexpected error occurred',
  title = 'Error'
): void {
  const message = getApiErrorMessage(err, fallbackMessage);
  Alert.alert(title, message);
}

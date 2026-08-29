/**
 * Crash Reporting Service
 * 
 * Provides a safe bridge to Firebase Crashlytics.
 * If `@react-native-firebase/crashlytics` is linked in the native runtime, errors
 * and diagnostics are submitted directly to Firebase Crashlytics.
 * If running in an environment without native Crashlytics linking (e.g. before an EAS
 * rebuild or in Expo Go), it gracefully records diagnostics locally to console
 * without throwing unlinked native module exceptions.
 */

let crashlyticsInstance: any = null;
let isCrashlyticsInitialized = false;

function getCrashlytics() {
  if (isCrashlyticsInitialized) {
    return crashlyticsInstance;
  }
  isCrashlyticsInitialized = true;
  try {
    // Attempt dynamic require so that missing native module doesn't cause a fatal startup crash
    const crashlyticsModule = require('@react-native-firebase/crashlytics');
    const crashlytics = crashlyticsModule?.default || crashlyticsModule;
    if (typeof crashlytics === 'function') {
      const instance = crashlytics();
      // Verify native module is actually linked
      if (instance && typeof instance.recordError === 'function') {
        crashlyticsInstance = instance;
        console.log('[CrashReporting] Firebase Crashlytics native module linked successfully');
      }
    }
  } catch (err) {
    // Native module not linked or package not yet installed
    console.log('[CrashReporting] Firebase Crashlytics native module not available; running in local diagnostics mode');
    crashlyticsInstance = null;
  }
  return crashlyticsInstance;
}

/**
 * Returns true if Firebase Crashlytics is natively active in the current app build.
 */
export function isNativeCrashlyticsAvailable(): boolean {
  return getCrashlytics() !== null;
}

/**
 * Record a non-fatal or fatal error to Crashlytics.
 */
export function recordError(
  error: Error,
  isFatal = false,
  extraContext?: Record<string, any>
): void {
  try {
    const cl = getCrashlytics();
    if (cl) {
      if (extraContext) {
        Object.entries(extraContext).forEach(([key, val]) => {
          try {
            cl.setAttribute(key, String(val));
          } catch (_) {}
        });
      }
      cl.recordError(error);
      return;
    }
  } catch (nativeErr) {
    console.warn('[CrashReporting] Failed to record error to Crashlytics:', nativeErr);
  }

  // Fallback diagnostic logging
  console.error('[CrashReporting - Local Fallback]', {
    name: error?.name,
    message: error?.message,
    stack: error?.stack,
    isFatal,
    extraContext,
  });
}

/**
 * Log a breadcrumb message to Crashlytics.
 */
export function logBreadcrumb(message: string): void {
  try {
    const cl = getCrashlytics();
    if (cl && typeof cl.log === 'function') {
      cl.log(message);
      return;
    }
  } catch (_) {}
  console.log(`[CrashReporting Breadcrumb] ${message}`);
}

/**
 * Associate user identity with crash reports.
 */
export function setCrashUser(userId: string, email?: string): void {
  try {
    const cl = getCrashlytics();
    if (cl) {
      cl.setUserId(userId);
      if (email && typeof cl.setAttribute === 'function') {
        cl.setAttribute('user_email', email);
      }
      return;
    }
  } catch (_) {}
}

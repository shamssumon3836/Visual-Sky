/**
 * Safe browser API access utilities to prevent DOMExceptions, SecurityErrors,
 * and uncaught exceptions in sandboxed iframes, private browsing, and webviews.
 */

export function getSafeNotificationPermission(): NotificationPermission {
  try {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      typeof Notification !== 'undefined' &&
      Notification.permission
    ) {
      return Notification.permission;
    }
  } catch {
    // Sandboxed iframes without allow="notifications" throw DOMException
  }
  return 'default';
}

export function isNotificationGranted(): boolean {
  try {
    return getSafeNotificationPermission() === 'granted';
  } catch {
    return false;
  }
}

export function safeGetStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {}
  return null;
}

export function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {}
}

export function safeRemoveStorage(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

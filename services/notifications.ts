// Push Notification and In-App Alert Service

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'attendance' | 'rental' | 'social' | 'system';
  link: string;
  createdAt: string;
  isRead: boolean;
}

const READ_NOTIFS_KEY = 'rmch_read_notifications';

export function getReadNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_NOTIFS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function markNotificationAsRead(id: string): void {
  try {
    const current = getReadNotificationIds();
    current.add(id);
    localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

export function markAllNotificationsAsRead(ids: string[]): void {
  try {
    const current = getReadNotificationIds();
    ids.forEach((id) => current.add(id));
    localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

export async function requestWebPushPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function sendLocalPushNotification(title: string, options?: NotificationOptions): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/icon-192.png',
        badge: '/favicon-32.png',
        ...options,
      });
    } catch {
      // fallback for platforms like Android PWA where ServiceWorkerRegistration.showNotification is required
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            icon: '/icon-192.png',
            badge: '/favicon-32.png',
            ...options,
          });
        });
      }
    }
  }
}

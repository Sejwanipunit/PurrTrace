/** Ask for notification permission if not already decided. Returns true if granted. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/** Show a system notification (no-op if permission isn't granted). */
export function notify(title: string, body: string, onClick?: () => void): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/paw-icon.svg',
      badge: '/paw-icon.svg',
      // Unique tag so a new alert never silently replaces an unread one.
      tag: `pawtrace-${Date.now()}`,
    });
    if (onClick) {
      n.onclick = () => {
        window.focus();
        onClick();
        n.close();
      };
    }
  } catch {
    /* some browsers throw if called outside a SW context; ignore */
  }
}

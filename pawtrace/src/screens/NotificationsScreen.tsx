import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { timeAgo } from '../lib/time';
import './NotificationsScreen.css';

export function NotificationsScreen() {
  const { notifications, markAllNotificationsRead, markNotificationRead } = useAppStore();
  const navigate = useNavigate();

  // Snapshot which were unread when the screen opened (for the accent), then clear the badge.
  const unreadAtOpen = useRef<Set<string>>(new Set(notifications.filter(n => !n.read).map(n => n.id)));
  useEffect(() => {
    if (notifications.some(n => !n.read)) markAllNotificationsRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (petId?: string, id?: string) => {
    if (id) markNotificationRead(id);
    if (petId) navigate(`/pet/${petId}`);
  };

  return (
    <div className="notifications-screen screen-content">
      <header className="notif-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" width="22" height="22">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="t-headline">Notifications</h1>
      </header>

      <div className="notif-body">
        {notifications.length === 0 ? (
          <div className="notif-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--sprout-300)" strokeWidth="2" width="52" height="52" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="t-title" style={{ color: 'var(--bark-700)' }}>You’re all caught up</p>
            <p className="t-body-m" style={{ color: 'var(--bark-500)' }}>
              We’ll tell you here when a found pet is reported near one of yours, or someone spots your pet.
            </p>
          </div>
        ) : (
          <ul className="notif-list">
            {notifications.map(n => {
              const isUnread = unreadAtOpen.current.has(n.id);
              const emoji = n.type === 'found_nearby' ? '🐾' : n.type === 'new_sighting' ? '👀' : '🔔';
              return (
                <li key={n.id}>
                  <button className={`notif-item ${isUnread ? 'notif-unread' : ''}`} onClick={() => open(n.petId, n.id)}>
                    <span className="notif-item-icon" aria-hidden="true">{emoji}</span>
                    <div className="notif-item-body">
                      <p className="t-body-l notif-item-title">{n.title}</p>
                      {n.body && <p className="t-body-s notif-item-text">{n.body}</p>}
                      <p className="t-body-s notif-item-time">{timeAgo(n.createdAt)}</p>
                    </div>
                    {isUnread && <span className="notif-dot" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

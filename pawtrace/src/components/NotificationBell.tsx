import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import './NotificationBell.css';

export function NotificationBell() {
  const { unreadCount } = useAppStore();
  const navigate = useNavigate();
  return (
    <button
      className="notif-bell"
      onClick={() => navigate('/notifications')}
      aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="22" height="22" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
    </button>
  );
}

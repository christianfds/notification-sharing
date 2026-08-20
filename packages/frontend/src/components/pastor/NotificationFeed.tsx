import type { Notification } from '../../types';
import NotificationCard from './NotificationCard';

export interface NotificationFeedProps {
  notifications: Notification[];
  onMarkRead?: (notificationId: string) => void;
}

export default function NotificationFeed({ notifications, onMarkRead }: NotificationFeedProps) {
  if (notifications.length === 0) {
    return (
      <div className="pastor-empty-state">
        <span className="pastor-empty-icon" aria-hidden="true">✓</span>
        <h2>Nenhuma notificação</h2>
        <p>Quando uma mensagem for enviada, ela aparecerá aqui.</p>
      </div>
    );
  }

  return (
    <section className="pastor-notification-feed" aria-label="Notificações recebidas">
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
        />
      ))}
    </section>
  );
}

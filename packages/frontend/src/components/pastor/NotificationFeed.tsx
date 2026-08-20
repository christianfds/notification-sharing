import type { Notification } from '../../types';
import NotificationCard from './NotificationCard';

export interface NotificationFeedProps {
  notifications: Notification[];
  onMarkRead?: (notificationId: string) => void;
  orderAnimationKey?: number;
}

export default function NotificationFeed({ notifications, onMarkRead, orderAnimationKey = 0 }: NotificationFeedProps) {
  if (notifications.length === 0) {
    return (
      <div className="pastor-empty-state">
        <span className="pastor-empty-icon" aria-hidden="true">✓</span>
        <h2>Nenhuma notificação</h2>
        <p>Quando uma mensagem for enviada, ela aparecerá aqui.</p>
      </div>
    );
  }

  const groups = notifications.reduce((result, notification) => {
    const categoryName = notification.category?.displayName ?? notification.category?.name ?? 'Sem categoria';
    const group = result.get(categoryName) ?? [];
    group.push(notification);
    result.set(categoryName, group);
    return result;
  }, new Map<string, Notification[]>());
  const entries = [...groups.entries()].sort(([, left], [, right]) => (left[0].category?.sortOrder ?? 0) - (right[0].category?.sortOrder ?? 0));

  return (
    <section className="pastor-notification-feed" aria-label="Notificações recebidas">
      {entries.map(([categoryName, group]) => (
        <section className={`pastor-notification-group${orderAnimationKey ? ' pastor-category-item-moving' : ''}`} key={categoryName}>
          <div className="pastor-notification-group-heading">
            <h2>{categoryName}</h2>
            <span>{group.length} {group.length === 1 ? 'aviso' : 'avisos'}</span>
          </div>
          <div className="pastor-notification-group-list">
            {group.map((notification) => <NotificationCard key={notification.id} notification={notification} onMarkRead={onMarkRead} />)}
          </div>
        </section>
      ))}
    </section>
  );
}

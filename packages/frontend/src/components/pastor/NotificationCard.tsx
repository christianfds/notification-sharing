import type { Notification } from '../../types';

interface NotificationCardProps {
  notification: Notification;
  onMarkRead?: (notificationId: string) => void;
}

function formatSentAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function NotificationCard({ notification, onMarkRead }: NotificationCardProps) {
  const isUnread = notification.readAt === null;
  const categoryName = notification.category?.displayName ?? notification.category?.name ?? 'Sem categoria';

  return (
    <article className={`pastor-notification-card${isUnread ? ' is-unread' : ''}`}>
      <div className="pastor-notification-content">
        <div className="pastor-notification-meta">
          <span className="pastor-category">{categoryName}</span>
          <time dateTime={notification.sentAt}>{formatSentAt(notification.sentAt)}</time>
        </div>
        <h2>{notification.title}</h2>
        <p>{notification.body}</p>
      </div>
      {isUnread && onMarkRead && (
        <button
          className="pastor-mark-read"
          type="button"
          onClick={() => onMarkRead(notification.id)}
        >
          Marcar como lida
        </button>
      )}
    </article>
  );
}

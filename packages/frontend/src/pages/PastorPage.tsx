import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import type { Notification, PaginatedResponse } from '../types';
import NotificationFeed from '../components/pastor/NotificationFeed';
import UnreadBadge from '../components/pastor/UnreadBadge';
import '../styles/pastor.css';
import useWebSocket from '../hooks/useWebSocket';
import ConnectionStatusBar from '../components/ConnectionStatusBar';
import type { WSNotificationNew, WSEvent } from '../types';

export interface PastorPageProps {
  /** Injection point for the notification:read WebSocket action in task 14.2. */
  onMarkRead?: (notificationId: string) => void;
}

function sortNewestFirst(notifications: Notification[]): Notification[] {
  return [...notifications].sort((left, right) => {
    const timeDifference = new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime();
    return timeDifference || right.id.localeCompare(left.id);
  });
}

function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === 'string') return message;
  }
  return 'Não foi possível carregar as notificações. Tente novamente.';
}

export default function PastorPage({ onMarkRead }: PastorPageProps) {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categoryOrderRevision, setCategoryOrderRevision] = useState(0);

  const loadNotifications = () => {
    return api.get<PaginatedResponse<Notification>>('/notifications', { params: { pageSize: 50 } })
      .then(({ data }) => {
        setNotifications(sortNewestFirst(data.data.filter((notification) => notification.readAt === null)));
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        setErrorMessage(getErrorMessage(error));
        throw error;
      });
  };

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    loadNotifications()
      .catch(() => undefined)
      .catch((error: unknown) => {
        if (isCurrent) setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, []);

  const handleSocketEvent = (event: WSEvent) => {
    if (event.type === 'notification:deleted') {
      const payload = event.payload as { notificationId: string };
      setNotifications((current) => current.filter((notification) => notification.id !== payload.notificationId));
      return;
    }
    if (event.type === 'notification:restored') {
      const incoming = event.payload as { id: string; body: string; category: Notification['category']; categoryId?: string; senderId?: string; sentAt: string; readAt: string | null };
      if (incoming.readAt === null) {
        setNotifications((current) => sortNewestFirst([...current.filter((notification) => notification.id !== incoming.id), { ...incoming, categoryId: incoming.categoryId ?? incoming.category?.id ?? '', senderId: incoming.senderId ?? '', deletedAt: null }]));
      }
      return;
    }
    if (event.type === 'notification:updated') {
      void loadNotifications();
      return;
    }
    if (event.type === 'category:order_updated') {
      setCategoryOrderRevision((current) => current + 1);
      void loadNotifications();
      return;
    }
    if (event.type === 'notification:status_updated') {
      const status = event.payload as { notificationId: string; readAt: string | null };
      if (status.readAt === null) void loadNotifications();
      return;
    }
    if (event.type !== 'notification:new') return;
    const incoming = event.payload as WSNotificationNew;
    setNotifications((current) => sortNewestFirst([
      ...current.filter((notification) => notification.id !== incoming.id),
      { ...incoming, readAt: null, deletedAt: null, senderId: '', categoryId: incoming.category.id },
    ]));
    if ('Notification' in window && window.Notification.permission === 'granted') {
      new window.Notification('Nova notificação', { body: incoming.body });
    }
    if ('vibrate' in navigator) navigator.vibrate([120, 60, 120]);
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.frequency.value = 660; gain.gain.value = 0.05;
      oscillator.start(); oscillator.stop(context.currentTime + 0.15);
    } catch { /* Audio may be blocked until the user interacts with the page. */ }
  };
  const { status: socketStatus, attempt: socketAttempt, error: socketError, retry, send } = useWebSocket({
    onEvent: handleSocketEvent,
    onReconnect: () => { void loadNotifications(); },
  });

  const unreadCount = notifications.filter(({ readAt }) => readAt === null).length;
  const handleMarkRead = (notificationId: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    onMarkRead?.(notificationId);
    send('notification:read', { notificationId });
  };

  return (
    <main className="pastor-page">
      <div className="pastor-shell">
        <header className="pastor-header">
          <div>
            <p className="pastor-eyebrow">Notification Sharing</p>
            <h1>Suas notificações</h1>
            <p className="pastor-welcome">Olá, {user?.username ?? 'Pastor'}. Acompanhe as mensagens da sua comunidade.</p>
          </div>
          <button className="pastor-logout" type="button" onClick={() => void logout()}>Sair</button>
        </header>
        <ConnectionStatusBar status={socketStatus} attempt={socketAttempt} error={socketError} onRetry={retry} />

        <div className="pastor-summary">
          <div>
            <p className="pastor-summary-label">Caixa de entrada</p>
            <p className="pastor-summary-value">Mensagens recentes</p>
          </div>
          <div className="pastor-unread-summary">
            <UnreadBadge count={unreadCount} />
            <span>{unreadCount === 1 ? 'não lida' : 'não lidas'}</span>
          </div>
        </div>

        {isLoading && <p className="pastor-status">Carregando notificações...</p>}
        {errorMessage && <p className="pastor-status pastor-error" role="alert">{errorMessage}</p>}
        {!isLoading && !errorMessage && (
           <NotificationFeed notifications={notifications} onMarkRead={handleMarkRead} orderAnimationKey={categoryOrderRevision} />
        )}
      </div>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '../../services/api';
import type { Category, Notification, PaginatedResponse } from '../../types';
import ReadStatusBadge from './ReadStatusBadge';

interface NotificationHistoryProps {
  readAtOverrides?: ReadonlyMap<string, string | null>;
  onReadStatusChange?: (notificationId: string, readAt: string | null) => void;
  refreshKey?: number;
}

const PAGE_SIZE = 50;
const MAX_RANGE_DAYS = 31;

function messageFromError(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? 'Não foi possível carregar o histórico.';
  }
  return 'Não foi possível carregar o histórico.';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function dateDifferenceInDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return (end - start) / (24 * 60 * 60 * 1000);
}

export default function NotificationHistory({ readAtOverrides, onReadStatusChange, refreshKey = 0 }: NotificationHistoryProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ body: '', categoryId: '' });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isGroupedView, setIsGroupedView] = useState(true);

  useEffect(() => {
    let active = true;

    api.get<Category[]>('/categories')
      .then(({ data }) => {
        if (active) setCategories(data);
      })
      .catch((loadError: unknown) => {
        if (active) setError(messageFromError(loadError));
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (from && to && (from > to || dateDifferenceInDays(from, to) > MAX_RANGE_DAYS)) {
      setNotifications([]);
      setTotalPages(0);
      setLoading(false);
      setError(from > to ? 'A data inicial deve ser anterior à data final.' : 'O intervalo máximo é de 31 dias.');
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    api.get<PaginatedResponse<Notification>>('/notifications', {
      params: {
        page,
        pageSize: PAGE_SIZE,
        ...(categoryId ? { categoryId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        includeDeleted: true,
      },
    })
      .then(({ data }) => {
        if (!active) return;
        setNotifications(data.data);
        setTotalPages(data.totalPages);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setNotifications([]);
        setTotalPages(0);
        setError(messageFromError(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [categoryId, from, page, refreshKey, to]);

  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const markUnread = async (notificationId: string) => {
    try {
      const { data } = await api.patch<Notification>(`/notifications/${notificationId}/read-status`, { read: false });
      setNotifications((current) => current.map((notification) => notification.id === notificationId ? { ...notification, readAt: data.readAt } : notification));
      onReadStatusChange?.(notificationId, data.readAt);
    } catch (cause) {
      setError(messageFromError(cause));
    }
  };

  const saveEdit = async (notificationId: string) => {
    if (!editValues.body.trim() || !editValues.categoryId) {
      setError('A mensagem e a categoria são obrigatórias.');
      return;
    }
    setSavingId(notificationId);
    try {
      const { data } = await api.put<Notification>(`/notifications/${notificationId}`, editValues);
      setNotifications((current) => current.map((item) => item.id === notificationId ? data : item));
      setEditingId(null);
    } catch (cause) {
      setError(messageFromError(cause));
    } finally {
      setSavingId(null);
    }
  };

  const removeNotification = async (notificationId: string) => {
    if (!window.confirm('Excluir esta notificação?')) return;
    setSavingId(notificationId);
    try {
      await api.delete(`/notifications/${notificationId}`);
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
    } catch (cause) {
      setError(messageFromError(cause));
    } finally {
      setSavingId(null);
    }
  };

  const restoreNotification = async (notificationId: string) => {
    setSavingId(notificationId);
    try {
      const { data } = await api.patch<Notification>(`/notifications/${notificationId}/restore`);
      setNotifications((current) => current.map((item) => item.id === notificationId ? data : item));
    } catch (cause) {
      setError(messageFromError(cause));
    } finally {
      setSavingId(null);
    }
  };

  const renderNotification = (notification: Notification) => {
    const readAt = readAtOverrides?.has(notification.id) ? readAtOverrides.get(notification.id) ?? null : notification.readAt;
    return <article className={`secretary-history-item${notification.deletedAt ? ' secretary-history-item-deleted' : readAt ? '' : ' secretary-history-item-unread'}`} key={notification.id}>
      <div className="secretary-history-top"><span className="secretary-category">{notification.category?.displayName ?? notification.category?.name ?? 'Sem categoria'}</span><time dateTime={notification.sentAt}>{formatDate(notification.sentAt)}</time></div>
      <p>{notification.body}</p>
      {notification.deletedAt ? <div className="secretary-read-actions"><span className="secretary-status secretary-status-deleted">Excluída</span><button className="secretary-inline-button secretary-inline-button-primary" type="button" disabled={savingId === notification.id} onClick={() => void restoreNotification(notification.id)}>Restaurar</button></div> : editingId === notification.id ? <div className="secretary-history-edit-form"><textarea value={editValues.body} maxLength={500} onChange={(event) => setEditValues({ ...editValues, body: event.target.value })} /><select value={editValues.categoryId} onChange={(event) => setEditValues({ ...editValues, categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.displayName}</option>)}</select><div className="secretary-read-actions"><button className="secretary-inline-button secretary-inline-button-primary" type="button" disabled={savingId === notification.id} onClick={() => void saveEdit(notification.id)}>Salvar</button><button className="secretary-inline-button" type="button" disabled={savingId === notification.id} onClick={() => setEditingId(null)}>Cancelar</button></div></div> : <div className="secretary-read-actions"><ReadStatusBadge readAt={readAt} />{readAt && <button className="secretary-inline-button" type="button" disabled={savingId === notification.id} onClick={() => void markUnread(notification.id)}>Marcar como não lida</button>}<button className="secretary-inline-button" type="button" disabled={savingId === notification.id} onClick={() => { setEditingId(notification.id); setEditValues({ body: notification.body, categoryId: notification.categoryId }); }}>Editar</button><button className="secretary-inline-button secretary-inline-button-danger" type="button" disabled={savingId === notification.id} onClick={() => void removeNotification(notification.id)}>Excluir</button></div>}
    </article>;
  };

  const groupedNotifications = [...notifications.reduce((groups, notification) => {
    const key = notification.category?.id ?? notification.categoryId;
    groups.set(key, [...(groups.get(key) ?? []), notification]);
    return groups;
  }, new Map<string, Notification[]>()).entries()].sort(([, left], [, right]) => (left[0].category?.sortOrder ?? 0) - (right[0].category?.sortOrder ?? 0));

  return (
    <section className="secretary-card secretary-history" aria-labelledby="notification-history-title">
      <div className="secretary-section-heading">
        <div>
          <p className="secretary-kicker">Registro</p>
          <h2 id="notification-history-title">Histórico de notificações</h2>
         </div>
         <button className="secretary-refresh-button" type="button" onClick={() => setIsGroupedView((current) => !current)}>{isGroupedView ? 'Visão em lista' : 'Visão por categorias'}</button>
      </div>

      <div className="secretary-history-filters" aria-label="Filtros do histórico">
        <label>
          Categoria
          <select value={categoryId} onChange={(event) => updateFilter(setCategoryId, event.target.value)}>
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.displayName}</option>
            ))}
          </select>
        </label>
        <label>
          De
          <input type="date" value={from} onChange={(event) => updateFilter(setFrom, event.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={to} onChange={(event) => updateFilter(setTo, event.target.value)} />
        </label>
      </div>

      {error && <p className="secretary-error" role="alert">{error}</p>}
      {loading ? (
        <p className="secretary-muted">Carregando histórico...</p>
      ) : notifications.length === 0 ? (
        <div className="secretary-empty">
          <span aria-hidden="true">○</span>
          <p>Nenhum resultado encontrado.</p>
        </div>
      ) : (
        <>
           {isGroupedView ? <div className="secretary-history-category-grid">{groupedNotifications.map(([categoryId, group]) => <section className="secretary-history-category-column" key={categoryId}><h3>{group[0].category?.displayName ?? group[0].category?.name ?? 'Sem categoria'}</h3><div className="secretary-history-list">{group.map(renderNotification)}</div></section>)}</div> : <div className="secretary-history-list">{notifications.map(renderNotification)}</div>}
          <nav className="secretary-history-pagination" aria-label="Paginação do histórico">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
              Anterior
            </button>
            <span>Página {page} de {totalPages}</span>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
              Próxima
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

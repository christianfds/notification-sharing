import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '../../services/api';
import type { Category, Notification, PaginatedResponse } from '../../types';
import ReadStatusBadge from './ReadStatusBadge';

interface NotificationHistoryProps {
  readAtOverrides?: ReadonlyMap<string, string | null>;
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

export default function NotificationHistory({ readAtOverrides }: NotificationHistoryProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [categoryId, from, page, to]);

  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <section className="secretary-card secretary-history" aria-labelledby="notification-history-title">
      <div className="secretary-section-heading">
        <div>
          <p className="secretary-kicker">Registro</p>
          <h2 id="notification-history-title">Histórico de notificações</h2>
        </div>
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
          <div className="secretary-history-list">
            {notifications.map((notification) => (
              <article className="secretary-history-item" key={notification.id}>
                <div className="secretary-history-top">
                  <span className="secretary-category">
                    {notification.category?.displayName ?? notification.category?.name ?? 'Sem categoria'}
                  </span>
                  <time dateTime={notification.sentAt}>{formatDate(notification.sentAt)}</time>
                </div>
                <h3>{notification.title}</h3>
                <ReadStatusBadge readAt={readAtOverrides?.has(notification.id) ? readAtOverrides.get(notification.id) ?? null : notification.readAt} />
              </article>
            ))}
          </div>
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

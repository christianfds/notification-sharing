import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import type { Category, Notification, PaginatedResponse, Template } from '../types';
import NotificationForm, { type NotificationFormValues } from '../components/secretary/NotificationForm';
import TemplateSelector from '../components/secretary/TemplateSelector';
import CategoryManager from '../components/secretary/CategoryManager';
import TemplateManager from '../components/secretary/TemplateManager';
import NotificationHistory from '../components/secretary/NotificationHistory';
import './SecretaryPage.css';
import useWebSocket from '../hooks/useWebSocket';
import type { WSNotificationSentAck, WSNotificationStatusUpdated, WSErrorPayload, WSEvent } from '../types';

const emptyForm: NotificationFormValues = { body: '', categoryId: '' };

function messageFromError(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? 'Não foi possível concluir a operação.';
  }
  return 'Não foi possível concluir a operação.';
}

function notificationList(data: unknown): Notification[] {
  if (Array.isArray(data)) return data as Notification[];
  if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
    return data.data as Notification[];
  }
  return [];
}

export default function SecretaryPage() {
  const { user, logout } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [values, setValues] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [metadataRefreshKey, setMetadataRefreshKey] = useState(0);
  const pendingAcks = useRef(new Map<string, { resolve: () => void; reject: (error: Error) => void }>());
  const acknowledged = useRef(new Set<string>());

  const handleSocketEvent = (event: WSEvent) => {
    if (event.type === 'category:order_updated' || event.type === 'template:changed' || event.type === 'notification:updated' || event.type === 'notification:deleted' || event.type === 'notification:restored') {
      setHistoryRefreshKey((current) => current + 1);
      if (event.type === 'category:order_updated' || event.type === 'template:changed') setMetadataRefreshKey((current) => current + 1);
      void loadData();
      return;
    }
    if (event.type === 'notification:sent_ack') {
      const payload = event.payload as WSNotificationSentAck;
      acknowledged.current.add(payload.notificationId);
      pendingAcks.current.get(payload.notificationId)?.resolve();
      pendingAcks.current.delete(payload.notificationId);
    } else if (event.type === 'notification:status_updated') {
      const payload = event.payload as WSNotificationStatusUpdated;
      setNotifications((current) => current.map((item) => item.id === payload.notificationId ? { ...item, readAt: payload.readAt } : item));
      setHistoryRefreshKey((current) => current + 1);
    } else if (event.type === 'error') {
      const payload = event.payload as WSErrorPayload;
      for (const pending of pendingAcks.current.values()) pending.reject(new Error(payload.message));
      pendingAcks.current.clear();
      setError(payload.message);
    }
  };
  const { status: socketStatus, error: socketError, retry } = useWebSocket({ onEvent: handleSocketEvent });
  const readAtOverrides = new Map(notifications.map((notification) => [notification.id, notification.readAt]));

  const updateReadStatus = (notificationId: string, readAt: string | null) => {
    setNotifications((current) => current.map((notification) => notification.id === notificationId ? { ...notification, readAt } : notification));
  };

  useEffect(() => {
    if (socketError) setError(socketError);
  }, [socketError]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [categoryResponse, templateResponse, notificationResponse] = await Promise.all([
        api.get<Category[]>('/categories'),
        api.get<Template[]>('/templates'),
        api.get<PaginatedResponse<Notification>>('/notifications', { params: { page: 1, pageSize: 50 } }),
      ]);
      setCategories(categoryResponse.data);
      setTemplates(templateResponse.data);
      setNotifications(notificationList(notificationResponse.data).filter((item) => item.senderId === user?.id));
      setError(null);
    } catch (loadError) {
      setError(messageFromError(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [user?.id]);

  const sendNotification = async () => {
    setSending(true);
    setSuccess(null);
    try {
      const { data: created } = await api.post<Notification>('/notifications', values);
      if (!acknowledged.current.has(created.id)) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            pendingAcks.current.delete(created.id);
            reject(new Error('A notificação foi criada, mas não houve confirmação em tempo real.'));
          }, 5000);
          pendingAcks.current.set(created.id, {
            resolve: () => { window.clearTimeout(timeout); resolve(); },
            reject: (ackError) => { window.clearTimeout(timeout); reject(ackError); },
          });
        });
      }
      setValues({ ...emptyForm, categoryId: values.categoryId });
      setSuccess('Notificação enviada ao pastor.');
      await loadData();
    } catch (sendError) {
      setError(sendError instanceof Error && sendError.message.includes('confirmação') ? sendError.message : messageFromError(sendError));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="secretary-page">
      <header className="secretary-header">
        <div className="secretary-brand"><span className="secretary-brand-mark">NS</span><div><p>Notification Sharing</p><h1>Painel da secretaria</h1></div></div>
        <div className="secretary-user"><span><strong>{user?.username}</strong><small>Secretaria</small></span><button type="button" onClick={() => void logout()}>Sair</button></div>
      </header>
       <section className="secretary-intro"><div><p className="secretary-kicker">Comunicação em tempo real</p><h2>Envie um aviso com clareza.</h2><p>Crie uma notificação para o pastor e acompanhe o que foi enviado nesta sessão.</p></div><div className="secretary-stats"><div className="secretary-stat"><strong>{notifications.length}</strong><span>enviadas nesta sessão</span></div><div className="secretary-stat secretary-stat-pending"><strong>{notifications.filter((notification) => notification.readAt === null).length}</strong><span>aguardando leitura</span></div></div></section>
      {error && <div className="secretary-banner secretary-error" role="alert">{error}</div>}
      {success && <div className="secretary-banner secretary-success" role="status">{success}</div>}
       {socketStatus !== 'connected' && <div className="secretary-banner secretary-error">Conexão em tempo real indisponível. <button className="secretary-refresh-button" type="button" onClick={retry}>Tentar novamente</button></div>}
       <div className="secretary-grid">
         <section className="secretary-card">
           <div className="secretary-card-toolbar"><div><p className="secretary-kicker">Envio</p><h2>Nova notificação</h2></div><button className="secretary-refresh-button" type="button" onClick={() => void loadData()} disabled={loading || sending}>{loading ? 'Atualizando...' : 'Atualizar'}</button></div>
           <TemplateSelector templates={templates} selectedTemplateId={templates.find((template) => template.body === values.body && (!template.categoryId || template.categoryId === values.categoryId))?.id} onSelect={(template) => setValues(template ? { ...values, body: template.body, categoryId: template.categoryId ?? values.categoryId } : { ...values, body: '' })} disabled={loading || sending} />
           <NotificationForm categories={categories} values={values} onChange={setValues} onSubmit={sendNotification} disabled={loading || sending} />
         </section>
         <section className="secretary-card"><CategoryManager refreshKey={metadataRefreshKey} onCategoriesChange={setCategories} /></section>
       </div>
       <div className="secretary-template-row">
         <section className="secretary-card"><TemplateManager refreshKey={metadataRefreshKey} onTemplatesChange={setTemplates} /></section>
       </div>
       <div className="secretary-history-row">
         <NotificationHistory refreshKey={historyRefreshKey} readAtOverrides={readAtOverrides} onReadStatusChange={updateReadStatus} />
       </div>
     </main>
  );
}

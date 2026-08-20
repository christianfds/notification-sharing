import { useEffect, useState, type CSSProperties } from 'react';
import { isAxiosError } from 'axios';
import api from '../services/api';
import type { User } from '../types';
import { useAuth } from '../hooks/useAuth';
import ConfirmModal from '../components/admin/ConfirmModal';
import UserForm, { type UserFormValues } from '../components/admin/UserForm';
import UserList from '../components/admin/UserList';
import SecretaryPage from './SecretaryPage';
import PastorPage from './PastorPage';

function apiError(error: unknown): string {
  if (!isAxiosError(error)) return 'Não foi possível concluir a operação. Tente novamente.';
  const data = error.response?.data as { error?: string; message?: string } | undefined;
  if (data?.error === 'USERNAME_TAKEN' || error.response?.status === 409) return 'Este nome de usuário já está em uso.';
  if (data?.error === 'VALIDATION_ERROR') return data.message ?? 'Confira os dados informados.';
  if (data?.error === 'ADMIN_SELF_DEACTIVATION') return 'Você não pode desativar sua própria conta.';
  return data?.message ?? 'Não foi possível concluir a operação. Tente novamente.';
}

export default function AdminPage() {
  const { logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<'admin' | 'secretary' | 'pastor'>('admin');

  const loadUsers = async () => { setIsLoading(true); setErrorMessage(null); try { const { data } = await api.get<User[]>('/users'); setUsers(data); } catch (error) { setErrorMessage(apiError(error)); } finally { setIsLoading(false); } };
  useEffect(() => { void loadUsers(); }, []);

  const saveUser = async (values: UserFormValues) => {
    setIsSubmitting(true); setFormError(null);
    try {
      const payload = values.password ? values : { username: values.username, role: values.role };
      const response = editingUser ? await api.put<User>(`/users/${editingUser.id}`, payload) : await api.post<User>('/users', values);
      setUsers((current) => editingUser ? current.map((user) => user.id === response.data.id ? response.data : user) : [...current, response.data]);
      setIsFormOpen(false); setEditingUser(null);
    } catch (error) { setFormError(apiError(error)); } finally { setIsSubmitting(false); }
  };

  const toggleStatus = async () => { if (!confirmUser) return; const user = confirmUser; setBusyUserId(user.id); setErrorMessage(null); try { const { data } = await api.patch<User>(`/users/${user.id}/status`, { isActive: !user.isActive }); setUsers((current) => current.map((item) => item.id === data.id ? data : item)); setConfirmUser(null); } catch (error) { setErrorMessage(apiError(error)); } finally { setBusyUserId(null); } };
  const openCreate = () => { setEditingUser(null); setFormError(null); setIsFormOpen(true); };
  const openEdit = (user: User) => { setEditingUser(user); setFormError(null); setIsFormOpen(true); };

  return <main style={styles.page}>
    <div style={styles.shell}>
      <header style={styles.header}>
        <div><p style={styles.eyebrow}>Notification Sharing / Administração</p><h1 style={styles.title}>Painel do administrador</h1><p style={styles.subtitle}>Gerencie usuários e acompanhe a comunicação da plataforma.</p></div>
        <button type="button" onClick={() => void logout()} style={styles.logout}>Sair</button>
      </header>
      <nav aria-label="Visões do painel" style={styles.navigation}>
        {([['admin', 'Usuários'], ['secretary', 'Visão da secretaria'], ['pastor', 'Visão do pastor']] as const).map(([view, label]) => <button key={view} type="button" onClick={() => setActiveView(view)} aria-current={activeView === view ? 'page' : undefined} style={activeView === view ? styles.navActive : styles.navButton}>{label}</button>)}
      </nav>
      <div style={styles.views}>
        <section aria-label="Gerenciamento de usuários" hidden={activeView !== 'admin'}>
          <header style={styles.viewHeader}><div><h2 style={styles.sectionTitle}>Usuários</h2><p style={styles.subtitle}>Gerencie perfis e acesso à plataforma.</p></div><button type="button" onClick={openCreate} style={styles.primary}>+ Novo usuário</button></header>
          <div style={styles.content}>{isFormOpen && <UserForm user={editingUser} isSubmitting={isSubmitting} errorMessage={formError} onSubmit={(values) => void saveUser(values)} onCancel={() => { setIsFormOpen(false); setEditingUser(null); }} />}<section aria-labelledby="users-title"><div style={styles.sectionHeading}><div><h2 id="users-title" style={styles.sectionTitle}>Todos os usuários</h2><p style={styles.count}>{users.length} {users.length === 1 ? 'usuário' : 'usuários'}</p></div>{errorMessage && <p role="alert" style={styles.error}>{errorMessage}</p>}</div><UserList users={users} isLoading={isLoading} busyUserId={busyUserId} onEdit={openEdit} onToggleStatus={setConfirmUser} /></section></div>
        </section>
        <section hidden={activeView !== 'secretary'} aria-label="Visão da secretaria"><SecretaryPage /></section>
        <section hidden={activeView !== 'pastor'} aria-label="Visão do pastor"><PastorPage /></section>
      </div>
    </div>
    <ConfirmModal open={confirmUser !== null} title={confirmUser?.isActive ? 'Desativar usuário?' : 'Ativar usuário?'} message={confirmUser ? `O acesso de ${confirmUser.username} será ${confirmUser.isActive ? 'bloqueado' : 'restaurado'}.` : ''} confirmLabel={confirmUser?.isActive ? 'Desativar' : 'Ativar'} isSubmitting={busyUserId !== null} onConfirm={() => void toggleStatus()} onCancel={() => setConfirmUser(null)} />
  </main>;
}

const styles: Record<string, CSSProperties> = { page: { minHeight: '100vh', padding: '32px 20px', background: '#f4f6f8', color: '#17212b', fontFamily: 'system-ui, sans-serif' }, shell: { maxWidth: '1100px', margin: '0 auto' }, header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', marginBottom: '22px', flexWrap: 'wrap' }, eyebrow: { margin: 0, color: '#5c7180', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }, title: { margin: '8px 0 5px', fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.04em' }, subtitle: { margin: 0, color: '#5c6670' }, logout: { padding: '10px 16px', border: '1px solid #ccd9df', borderRadius: '7px', background: '#fff', color: '#245a75', fontWeight: 700, cursor: 'pointer' }, navigation: { display: 'flex', gap: '8px', marginBottom: '28px', padding: '6px', borderRadius: '10px', background: '#e5ebee', flexWrap: 'wrap' }, navButton: { padding: '10px 14px', border: 0, borderRadius: '7px', background: 'transparent', color: '#53616c', cursor: 'pointer', fontWeight: 700 }, navActive: { padding: '10px 14px', border: 0, borderRadius: '7px', background: '#fff', color: '#245a75', cursor: 'pointer', fontWeight: 700, boxShadow: '0 1px 4px #17212b20' }, views: { display: 'grid' }, viewHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }, primary: { padding: '11px 16px', border: 0, borderRadius: '7px', background: '#245a75', color: '#fff', fontWeight: 700, cursor: 'pointer' }, content: { display: 'grid', gap: '28px' }, sectionHeading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '12px', flexWrap: 'wrap' }, sectionTitle: { margin: 0, fontSize: '1.3rem' }, count: { margin: '4px 0 0', color: '#6b7880', fontSize: '0.9rem' }, error: { margin: 0, padding: '10px 13px', borderRadius: '7px', background: '#fff0f0', color: '#a32929', fontSize: '0.9rem' } };

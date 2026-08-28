import { useState, type CSSProperties, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole, type LoginRequest } from '../types';

function routeForRole(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return '/admin';
    case UserRole.SECRETARY:
      return '/secretary';
    case UserRole.PASTOR:
      return '/pastor';
  }
}

function getLoginError(error: unknown): string {
  if (!isAxiosError(error)) return 'Não foi possível entrar. Tente novamente.';

  const data = error.response?.data as {
    error?: string;
    message?: string;
    retryAfterSeconds?: number;
  } | undefined;

  if (data?.error === 'ACCOUNT_LOCKED' || error.response?.status === 423) {
    const retryMessage = data?.retryAfterSeconds
      ? ` Tente novamente em aproximadamente ${Math.ceil(data.retryAfterSeconds / 60)} minuto(s).`
      : '';
    return `Conta bloqueada.${retryMessage}`;
  }

  if (data?.error === 'INVALID_CREDENTIALS') return 'Usuário ou senha inválidos.';
  if (data?.error === 'ACCOUNT_INACTIVE') return 'Esta conta está inativa.';
  return data?.message ?? 'Não foi possível entrar. Tente novamente.';
}

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, user } = useAuth();
  const location = useLocation();
  const [credentials, setCredentials] = useState<LoginRequest>({ username: '', password: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && isAuthenticated && user) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    const roleRoute = routeForRole(user.role);
    const destination = from && from === roleRoute ? from : roleRoute;
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await login(credentials);
    } catch (error) {
      setErrorMessage(getLoginError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card} aria-labelledby="login-title">
        <img src="/favicon.svg" alt="" aria-hidden="true" style={styles.brandMark} />
        <p style={styles.eyebrow}>Notification Sharing</p>
        <h1 id="login-title" style={styles.title}>Entrar</h1>
        <p style={styles.subtitle}>Acesse o painel de notificações.</p>

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          <label style={styles.label} htmlFor="username">Nome de usuário</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={credentials.username}
            onChange={(event) => setCredentials({ ...credentials, username: event.target.value })}
            required
            disabled={isSubmitting}
            style={styles.input}
          />

          <label style={styles.label} htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={credentials.password}
            onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
            required
            disabled={isSubmitting}
            style={styles.input}
          />

          {errorMessage && <p role="alert" style={styles.error}>{errorMessage}</p>}
          <button style={styles.submit} type="submit" disabled={isSubmitting || !credentials.username || !credentials.password}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: 'radial-gradient(circle at 85% 0%, #dcece5 0, transparent 32rem), #f5f7f6', color: '#17212b', fontFamily: 'system-ui, sans-serif' },
  card: { width: '100%', maxWidth: '420px', padding: 'clamp(24px, 6vw, 40px)', background: 'rgba(255,255,255,.92)', border: '1px solid #dde6e2', borderRadius: '16px', boxShadow: '0 12px 35px rgba(35, 68, 60, .10)' },
  brandMark: { display: 'block', width: '44px', height: '44px', borderRadius: '12px' },
  eyebrow: { margin: '18px 0 8px', color: '#59716b', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' },
  title: { margin: 0, color: '#173d39', fontFamily: 'Georgia, serif', fontSize: '2.5rem', fontWeight: 500, letterSpacing: '-.04em' },
  subtitle: { margin: '10px 0 28px', color: '#61716e' },
  form: { display: 'grid', gap: '10px' },
  label: { color: '#384b47', fontSize: '.85rem', fontWeight: 700 },
  input: { boxSizing: 'border-box', width: '100%', border: '1px solid #cbd8d3', borderRadius: '8px', background: '#fff', padding: '11px 12px', color: '#17212b', font: 'inherit' },
  error: { margin: '6px 0', padding: '10px 12px', borderRadius: '6px', background: '#fff0f0', color: '#a32929', fontSize: '0.9rem' },
  submit: { marginTop: '8px', border: 0, borderRadius: '8px', padding: '13px', background: '#174f47', color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' },
};

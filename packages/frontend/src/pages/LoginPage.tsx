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
        <div style={styles.brandMark} aria-hidden="true">NS</div>
        <p style={styles.eyebrow}>Notification Sharing</p>
        <h1 id="login-title" style={styles.title}>Entrar</h1>
        <p style={styles.subtitle}>Acesse o painel da sua comunidade.</p>

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          <label htmlFor="username">Nome de usuário</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={credentials.username}
            onChange={(event) => setCredentials({ ...credentials, username: event.target.value })}
            required
            disabled={isSubmitting}
          />

          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={credentials.password}
            onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
            required
            disabled={isSubmitting}
          />

          {errorMessage && <p role="alert" style={styles.error}>{errorMessage}</p>}
          <button type="submit" disabled={isSubmitting || !credentials.username || !credentials.password}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f4f6f8', color: '#17212b', fontFamily: 'system-ui, sans-serif' },
  card: { width: '100%', maxWidth: '420px', padding: '40px', background: '#fff', border: '1px solid #e1e6eb', borderRadius: '12px', boxShadow: '0 12px 30px rgba(23, 33, 43, 0.08)' },
  brandMark: { width: '44px', height: '44px', display: 'grid', placeItems: 'center', borderRadius: '10px', background: '#245a75', color: '#fff', fontWeight: 700, letterSpacing: '0.04em' },
  eyebrow: { margin: '18px 0 8px', color: '#5c7180', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
  title: { margin: 0, fontSize: '2rem' },
  subtitle: { margin: '8px 0 28px', color: '#5c6670' },
  form: { display: 'grid', gap: '10px' },
  error: { margin: '6px 0', padding: '10px 12px', borderRadius: '6px', background: '#fff0f0', color: '#a32929', fontSize: '0.9rem' },
};

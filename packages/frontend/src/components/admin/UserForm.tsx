import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { UserRole, type User } from '../../types';

export interface UserFormValues { username: string; password: string; role: UserRole; }

interface UserFormProps {
  user: User | null;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
}

const roleLabels: Record<UserRole, string> = { [UserRole.SECRETARY]: 'Secretário', [UserRole.PASTOR]: 'Pastor', [UserRole.ADMIN]: 'Administrador' };

export default function UserForm({ user, isSubmitting = false, errorMessage, onSubmit, onCancel }: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>({ username: '', password: '', role: UserRole.SECRETARY });
  const [validationError, setValidationError] = useState<string | null>(null);
  const isEditing = user !== null;
  const isSuperAdmin = user?.isSuperAdmin === true;

  useEffect(() => {
    setValues({ username: user?.username ?? '', password: '', role: user?.role ?? UserRole.SECRETARY });
    setValidationError(null);
  }, [user]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (values.username.trim().length < 3) { setValidationError('O nome de usuário deve ter pelo menos 3 caracteres.'); return; }
    if (!isEditing && values.password.length < 8) { setValidationError('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (isEditing && values.password.length > 0 && values.password.length < 8) { setValidationError('A nova senha deve ter pelo menos 8 caracteres.'); return; }
    setValidationError(null);
    onSubmit({ ...values, username: values.username.trim() });
  };

  return (
    <form onSubmit={submit} style={styles.form} noValidate>
      <div style={styles.heading}><div><p style={styles.eyebrow}>{isEditing ? 'Editar cadastro' : 'Novo cadastro'}</p><h2 style={styles.title}>{isEditing ? user.username : 'Adicionar usuário'}</h2></div>{isEditing && <button type="button" onClick={onCancel} style={styles.close} aria-label="Fechar formulário">×</button>}</div>
      <label style={styles.label} htmlFor="admin-username">Nome de usuário</label>
      <input style={styles.input} id="admin-username" value={values.username} onChange={(event) => setValues({ ...values, username: event.target.value })} disabled={isSubmitting} required autoComplete="username" />
      <label style={styles.label} htmlFor="admin-role">Perfil</label>
      <select style={styles.input} id="admin-role" value={values.role} onChange={(event) => setValues({ ...values, role: event.target.value as UserRole })} disabled={isSubmitting}>
        <option value={UserRole.SECRETARY}>{roleLabels[UserRole.SECRETARY]}</option>
        <option value={UserRole.PASTOR}>{roleLabels[UserRole.PASTOR]}</option>
        <option value={UserRole.ADMIN}>{roleLabels[UserRole.ADMIN]}</option>
      </select>
       <label style={styles.label} htmlFor="admin-password">{isSuperAdmin ? 'Senha (protegida)' : isEditing ? 'Nova senha (opcional)' : 'Senha'}</label>
       <input style={styles.input} id="admin-password" type="password" value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} disabled={isSubmitting || isSuperAdmin} required={!isEditing && !isSuperAdmin} autoComplete="new-password" />
      {(validationError || errorMessage) && <p role="alert" style={styles.error}>{validationError || errorMessage}</p>}
      <div style={styles.actions}><button type="button" onClick={onCancel} disabled={isSubmitting} style={styles.secondary}>Cancelar</button><button type="submit" disabled={isSubmitting} style={styles.primary}>{isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar usuário'}</button></div>
    </form>
  );
}

const styles: Record<string, CSSProperties> = {
  form: { display: 'grid', gap: '9px', padding: '24px', border: '1px solid #dce4e8', borderRadius: '14px', background: '#fff' },
  heading: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' },
  eyebrow: { margin: 0, color: '#5c7180', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' },
  title: { margin: '5px 0 0', color: '#17212b', fontSize: '1.35rem' },
  label: { color: '#33444f', fontSize: '0.85rem', fontWeight: 700 },
  input: { boxSizing: 'border-box', width: '100%', padding: '10px 11px', border: '1px solid #cbd8d3', borderRadius: '8px', background: '#fff', color: '#17212b', font: 'inherit' },
  close: { border: 0, background: 'transparent', color: '#64747d', fontSize: '1.7rem', lineHeight: 1, cursor: 'pointer' },
  error: { margin: '5px 0', padding: '10px 12px', borderRadius: '7px', background: '#fff0f0', color: '#a32929', fontSize: '0.9rem' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '9px', marginTop: '10px', flexWrap: 'wrap' },
  primary: { padding: '10px 15px', border: 0, borderRadius: '7px', background: '#245a75', color: '#fff', cursor: 'pointer' },
  secondary: { padding: '10px 15px', border: '1px solid #d5dde2', borderRadius: '7px', background: '#fff', color: '#33444f', cursor: 'pointer' },
};

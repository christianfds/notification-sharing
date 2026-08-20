import { useState, type FormEvent } from 'react';
import type { Category } from '../../types';

export const NOTIFICATION_BODY_MAX_LENGTH = 500;

export interface NotificationFormValues {
  body: string;
  categoryId: string;
}

interface NotificationFormProps {
  categories: Category[];
  values: NotificationFormValues;
  onChange: (values: NotificationFormValues) => void;
  onSubmit: () => Promise<void>;
  disabled?: boolean;
}

export default function NotificationForm({
  categories,
  values,
  onChange,
  onSubmit,
  disabled = false,
}: NotificationFormProps) {
  const [error, setError] = useState<string | null>(null);
  const update = (field: keyof NotificationFormValues, value: string) => {
    onChange({ ...values, [field]: value });
    if (error) setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.body.trim()) {
      setError('A mensagem é obrigatória.');
      return;
    }
    if (!values.categoryId) {
      setError('Selecione uma categoria.');
      return;
    }
    setError(null);
    await onSubmit();
  };

  return (
    <form className="secretary-form" onSubmit={handleSubmit} noValidate>
      <div className="secretary-form-heading">
        <div>
          <p className="secretary-kicker">Novo aviso</p>
          <h2>Enviar notificação</h2>
        </div>
        <span className="secretary-live-dot">Pronto para enviar</span>
      </div>
      <label htmlFor="notification-body">Mensagem</label>
      <textarea
        id="notification-body"
        value={values.body}
        maxLength={NOTIFICATION_BODY_MAX_LENGTH}
        onChange={(event) => update('body', event.target.value)}
        placeholder="Escreva a mensagem que será exibida ao pastor..."
        rows={7}
        disabled={disabled}
        required
      />
      <div className="secretary-field-meta"><span>Obrigatório</span><span>{values.body.length}/{NOTIFICATION_BODY_MAX_LENGTH}</span></div>

      <label htmlFor="notification-category">Categoria</label>
      <select
        id="notification-category"
        value={values.categoryId}
        onChange={(event) => update('categoryId', event.target.value)}
        disabled={disabled}
        required
      >
        <option value="">Selecione uma categoria</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.displayName}</option>)}
      </select>
      {error && <p className="secretary-form-error" role="alert">{error}</p>}
      <button className="secretary-submit" type="submit" disabled={disabled || categories.length === 0}>
        {disabled ? 'Enviando...' : 'Enviar notificação'}
      </button>
    </form>
  );
}

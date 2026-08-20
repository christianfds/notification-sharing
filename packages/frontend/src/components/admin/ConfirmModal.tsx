import type { CSSProperties } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ open, title, message, confirmLabel, isSubmitting = false, onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div role="presentation" style={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section role="dialog" aria-modal="true" aria-labelledby="confirm-title" style={styles.modal}>
        <h2 id="confirm-title" style={styles.title}>{title}</h2>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button type="button" onClick={onCancel} disabled={isSubmitting} style={styles.cancel}>Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={isSubmitting} style={styles.confirm}>{isSubmitting ? 'Aguarde...' : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, zIndex: 10, display: 'grid', placeItems: 'center', padding: '20px', background: 'rgba(15, 28, 38, 0.48)' },
  modal: { width: '100%', maxWidth: '440px', padding: '28px', borderRadius: '16px', background: '#fff', boxShadow: '0 20px 60px rgba(15, 28, 38, 0.25)' },
  title: { margin: 0, color: '#17212b', fontSize: '1.25rem' },
  message: { margin: '12px 0 24px', color: '#53616c', lineHeight: 1.5 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' },
  cancel: { padding: '10px 16px', border: '1px solid #d5dde2', borderRadius: '7px', background: '#fff', color: '#33444f', cursor: 'pointer' },
  confirm: { padding: '10px 16px', border: 0, borderRadius: '7px', background: '#245a75', color: '#fff', cursor: 'pointer' },
};

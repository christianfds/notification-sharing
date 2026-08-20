import type { WebSocketStatus } from '../hooks/useWebSocket';

interface ConnectionStatusBarProps {
  status: WebSocketStatus;
  attempt: number;
  error?: string | null;
  onRetry: () => void;
}

export default function ConnectionStatusBar({ status, attempt, error, onRetry }: ConnectionStatusBarProps) {
  if (status === 'connected') return null;
  const isFailed = status === 'failed';
  const label = isFailed
    ? 'Sem conexão em tempo real.'
    : status === 'connecting' ? 'Conectando...' : `Reconectando${attempt ? ` (${attempt}/5)` : ''}...`;
  return (
    <div className="connection-status-bar" role="status">
      <span>{error ?? label}</span>
      {isFailed && <button type="button" onClick={onRetry}>Tentar novamente</button>}
    </div>
  );
}

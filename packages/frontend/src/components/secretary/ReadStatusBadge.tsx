interface ReadStatusBadgeProps {
  readAt: string | null;
}

function formatReadAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function ReadStatusBadge({ readAt }: ReadStatusBadgeProps) {
  if (readAt) {
    return (
      <span className="secretary-status secretary-status-read" aria-label={`Lida em ${formatReadAt(readAt)}`}>
        Lida em {formatReadAt(readAt)}
      </span>
    );
  }

  return (
    <span className="secretary-status" aria-label="Ainda não lida">
      Não lida
    </span>
  );
}

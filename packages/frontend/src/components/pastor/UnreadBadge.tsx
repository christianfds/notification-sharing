interface UnreadBadgeProps {
  count: number;
}

export default function UnreadBadge({ count }: UnreadBadgeProps) {
  return (
    <span className="pastor-unread-badge" aria-label={`${count} unread notifications`}>
      {count}
    </span>
  );
}

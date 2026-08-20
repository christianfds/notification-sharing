import type { CSSProperties } from 'react';

interface StatusBadgeProps {
  isActive: boolean;
}

export default function StatusBadge({ isActive }: StatusBadgeProps) {
  return (
    <span style={{ ...styles.badge, ...(isActive ? styles.active : styles.inactive) }}>
      <span aria-hidden="true" style={styles.dot} />
      {isActive ? 'Ativo' : 'Inativo'}
    </span>
  );
}

const styles: Record<string, CSSProperties> = {
  badge: { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 9px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' },
  active: { background: '#e8f6ef', color: '#17643b' },
  inactive: { background: '#f1f2f4', color: '#5f6872' },
  dot: { width: '7px', height: '7px', borderRadius: '50%', background: 'currentColor' },
};

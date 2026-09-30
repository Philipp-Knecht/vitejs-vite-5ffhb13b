import { cn } from '../../lib/format';

export function Spinner({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return (
    <span
      className={cn('spinner', `spinner--${size}`)}
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
    >
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}

export function PageLoading({ label = 'Wird geladen …' }: { label?: string }) {
  return (
    <div className="page-loading">
      <Spinner size="lg" label={label} />
    </div>
  );
}

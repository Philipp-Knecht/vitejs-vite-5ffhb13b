import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/format';

type Tone = 'info' | 'success' | 'warning' | 'error';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  actions,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      className={cn('alert', `alert--${tone}`, className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="alert__icon" aria-hidden size={20} />
      <div className="alert__body">
        {title && <p className="alert__title">{title}</p>}
        {children && <div className="alert__text">{children}</div>}
        {actions && <div className="alert__actions">{actions}</div>}
      </div>
    </div>
  );
}

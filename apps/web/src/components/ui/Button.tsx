import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '../../lib/format';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /** Icon after the label, e.g. an arrow. */
  iconEnd?: ReactNode;
  block?: boolean;
}

function classes({ variant = 'primary', size = 'md', block }: CommonProps, className?: string) {
  return cn('btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', className);
}

export function Button({
  variant,
  size,
  icon,
  iconEnd,
  block,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type={type}
      className={classes({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children !== undefined && <span>{children}</span>}
      {!loading && iconEnd}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  icon,
  iconEnd,
  block,
  className,
  children,
  ...rest
}: CommonProps & LinkProps) {
  return (
    <Link className={classes({ variant, size, block }, className)} {...rest}>
      {icon}
      <span>{children}</span>
      {iconEnd}
    </Link>
  );
}

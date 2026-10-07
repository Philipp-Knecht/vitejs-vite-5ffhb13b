import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/format';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
}

function describedBy(
  hintId: string,
  errorId: string,
  hint: unknown,
  error: unknown,
): string | undefined {
  return [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
}

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  className,
  id: providedId,
  ...input
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className={cn('field', className)}>
      <label className={cn('field__label', hideLabel && 'visually-hidden')} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={cn('input', error && 'input--invalid')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, `${id}-error`, hint, error)}
        {...input}
      />
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  hideLabel,
  className,
  id: providedId,
  ...textarea
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className={cn('field', className)}>
      <label className={cn('field__label', hideLabel && 'visually-hidden')} htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className={cn('input', 'input--textarea', error && 'input--invalid')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, `${id}-error`, hint, error)}
        {...textarea}
      />
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  hideLabel,
  className,
  id: providedId,
  children,
  ...select
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className={cn('field', className)}>
      <label className={cn('field__label', hideLabel && 'visually-hidden')} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={cn('input', 'input--select', error && 'input--invalid')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, `${id}-error`, hint, error)}
        {...select}
      >
        {children}
      </select>
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

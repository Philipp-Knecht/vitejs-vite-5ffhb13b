import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Modal dialog based on the native <dialog> element (focus handling,
 * Escape and inert background come from the browser).
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${size}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop targets the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="dialog__panel">
          <header className="dialog__header">
            <h2 className="dialog__title" id={titleId}>
              {title}
            </h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
              <X aria-hidden size={20} />
            </button>
          </header>
          <div className="dialog__body">{children}</div>
          {footer && <footer className="dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

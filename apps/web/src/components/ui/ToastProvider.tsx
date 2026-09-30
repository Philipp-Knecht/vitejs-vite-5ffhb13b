import { CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ToastContext } from './toast-context';

interface Toast {
  id: number;
  message: string;
}

let nextId = 1;

/** Short confirmations ("Kopiert"), announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback((message: string) => {
    nextId += 1;
    setToast({ id: nextId, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(
      () => setToast((current) => (current?.id === toast.id ? null : current)),
      3200,
    );
    return () => window.clearTimeout(timer);
  }, [toast]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className="toast" key={toast.id}>
            <CheckCircle2 aria-hidden size={18} />
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

import type { ReactNode } from 'react';

export function ResultSection({
  id,
  title,
  lead,
  actions,
  children,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="result-section" aria-labelledby={`${id}-title`}>
      <header className="result-section__header">
        <div>
          <h2 id={`${id}-title`} className="result-section__title">
            {title}
          </h2>
          {lead && <p className="result-section__lead">{lead}</p>}
        </div>
        {actions && <div className="result-section__actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function Quote({ children }: { children: string }) {
  return <q className="quote">{children}</q>;
}

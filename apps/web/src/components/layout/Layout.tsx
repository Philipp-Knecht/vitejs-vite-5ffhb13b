import type { ReactNode } from 'react';
import { useOnline } from '../../lib/offline';
import { ErrorBoundary } from './ErrorBoundary';
import { Footer } from './Footer';
import { Header } from './Header';

export function Layout({ children }: { children: ReactNode }) {
  const online = useOnline();
  return (
    <div className="app">
      <a className="skip-link" href="#inhalt">
        Zum Inhalt springen
      </a>
      <Header />
      <p className="offline-banner" role="status">
        {online
          ? null
          : 'Du bist offline. Du siehst den zuletzt geladenen Stand; neue Prüfungen und Änderungen gehen erst wieder mit Verbindung.'}
      </p>
      <main id="inhalt" className="main" tabIndex={-1}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

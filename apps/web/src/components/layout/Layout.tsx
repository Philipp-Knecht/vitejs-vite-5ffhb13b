import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { Footer } from './Footer';
import { Header } from './Header';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <a className="skip-link" href="#inhalt">
        Zum Inhalt springen
      </a>
      <Header />
      <main id="inhalt" className="main" tabIndex={-1}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

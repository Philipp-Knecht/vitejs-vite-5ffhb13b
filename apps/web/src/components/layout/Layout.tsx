import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useOfflineChecks, useOnline, type OfflineCheck } from '../../lib/offline';
import { ErrorBoundary } from './ErrorBoundary';
import { Footer } from './Footer';
import { Header } from './Header';

export function OfflineChecksNav({
  checks,
  onNavigate,
  className = 'offline-checks',
}: {
  checks: readonly OfflineCheck[];
  onNavigate?: () => void;
  className?: string;
}) {
  if (checks.length === 0) return null;
  return (
    <nav className={className} aria-label="Offline gespeicherte Prüfungen">
      <span>Offline gespeichert:</span>
      <ul>
        {checks.map((check) => (
          <li key={check.id}>
            <Link to={`/analyse/${check.id}`} onClick={onNavigate}>
              {check.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Inside main, so that the message is not content outside every landmark. */
export function OfflineBanner({ online }: { online: boolean }) {
  return (
    <p className="offline-banner" role="status">
      {online ? null : (
        <>
          Du bist offline. Du siehst den zuletzt geladenen Stand; neue Prüfungen und Änderungen
          gehen erst wieder mit Verbindung.
        </>
      )}
    </p>
  );
}

/**
 * The checks saved in this browser, offline: outside the status message, so
 * that going offline is announced briefly. The start page lists them itself.
 */
function OfflineChecks({ online }: { online: boolean }) {
  const { pathname } = useLocation();
  const checks = useOfflineChecks(!online);
  return (
    <OfflineChecksNav checks={checks.filter((check) => pathname !== `/analyse/${check.id}`)} />
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const online = useOnline();
  const { pathname } = useLocation();
  // The start page is the assistant: it brings its own bar, menu and legal links.
  if (pathname === '/') {
    return (
      <div className="app app--home">
        <a className="skip-link" href="#inhalt">
          Zum Inhalt springen
        </a>
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    );
  }
  return (
    <div className="app">
      <a className="skip-link" href="#inhalt">
        Zum Inhalt springen
      </a>
      <Header />
      <main id="inhalt" className="main" tabIndex={-1}>
        <OfflineBanner online={online} />
        <OfflineChecks online={online} />
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

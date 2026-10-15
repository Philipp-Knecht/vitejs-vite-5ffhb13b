import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { savedOfflineChecks, useOnline, type OfflineCheck } from '../../lib/offline';
import { ErrorBoundary } from './ErrorBoundary';
import { Footer } from './Footer';
import { Header } from './Header';

/**
 * The checks saved in this browser, while offline. The installed app starts on
 * the homepage, from where they could otherwise not be reached.
 */
function OfflineChecks() {
  const { pathname } = useLocation();
  const [checks, setChecks] = useState<OfflineCheck[]>([]);
  useEffect(() => {
    let active = true;
    savedOfflineChecks()
      .then((items) => {
        if (active) setChecks(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const others = checks.filter((check) => pathname !== `/analyse/${check.id}`);
  if (others.length === 0) return null;
  return (
    <>
      {' '}
      Offline gespeichert:{' '}
      {others.map((check, index) => (
        <span key={check.id}>
          {index > 0 && ', '}
          <Link to={`/analyse/${check.id}`}>{check.title}</Link>
        </span>
      ))}
    </>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const online = useOnline();
  return (
    <div className="app">
      <a className="skip-link" href="#inhalt">
        Zum Inhalt springen
      </a>
      <Header />
      <p className="offline-banner" role="status">
        {online ? null : (
          <>
            Du bist offline. Du siehst den zuletzt geladenen Stand; neue Prüfungen und Änderungen
            gehen erst wieder mit Verbindung.
            <OfflineChecks />
          </>
        )}
      </p>
      <main id="inhalt" className="main" tabIndex={-1}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

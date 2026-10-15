import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { savedOfflineChecks, useOnline, type OfflineCheck } from '../../lib/offline';
import { ErrorBoundary } from './ErrorBoundary';
import { Footer } from './Footer';
import { Header } from './Header';

/**
 * The checks saved in this browser, offline and on the homepage – where the
 * installed app starts, also with weak reception that still counts as online.
 * Outside the status message, so that going offline is announced briefly.
 */
function OfflineChecks({ online }: { online: boolean }) {
  const { pathname } = useLocation();
  const [checks, setChecks] = useState<OfflineCheck[]>([]);
  const shown = !online || pathname === '/';
  useEffect(() => {
    if (!shown) return;
    let active = true;
    savedOfflineChecks()
      .then((items) => {
        if (active) setChecks(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shown]);
  const others = checks.filter((check) => pathname !== `/analyse/${check.id}`);
  if (!shown || others.length === 0) return null;
  return (
    <nav className="offline-checks" aria-label="Offline gespeicherte Prüfungen">
      <span>Offline gespeichert:</span>
      <ul>
        {others.map((check) => (
          <li key={check.id}>
            <Link to={`/analyse/${check.id}`}>{check.title}</Link>
          </li>
        ))}
      </ul>
    </nav>
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
      <main id="inhalt" className="main" tabIndex={-1}>
        {/* Inside main, so that the message is not content outside every landmark. */}
        <p className="offline-banner" role="status">
          {online ? null : (
            <>
              Du bist offline. Du siehst den zuletzt geladenen Stand; neue Prüfungen und Änderungen
              gehen erst wieder mit Verbindung.
            </>
          )}
        </p>
        <OfflineChecks online={online} />
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

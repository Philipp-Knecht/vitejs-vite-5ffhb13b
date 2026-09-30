import { Link } from 'react-router';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo />
          <p>
            KaufCheck ordnet Auto-Inserate, zeigt fehlende Angaben und hilft dir, die richtigen
            Fragen zu stellen. Eine Besichtigung oder Prüfung durch eine Fachwerkstatt ersetzt das
            nicht.
          </p>
        </div>
        <nav className="footer__column" aria-label="Produkt">
          <p className="footer__heading">KaufCheck</p>
          <Link to="/">Inserat prüfen</Link>
          <Link to="/inseratstext">Inseratstext einfügen</Link>
          <Link to="/meine-angebote">Meine Angebote</Link>
          <Link to="/pro">KaufCheck Pro</Link>
        </nav>
        <nav className="footer__column" aria-label="Ratgeber">
          <p className="footer__heading">Ratgeber</p>
          <Link to="/gebrauchtwagen-kaufen">Gebrauchtwagen kaufen</Link>
          <Link to="/gebrauchtwagen-checkliste">Gebrauchtwagen-Checkliste</Link>
          <Link to="/auto-besichtigung-checkliste">Checkliste Besichtigung</Link>
        </nav>
        <nav className="footer__column" aria-label="Rechtliches">
          <p className="footer__heading">Rechtliches</p>
          <Link to="/impressum">Impressum</Link>
          <Link to="/datenschutz">Datenschutz</Link>
          <Link to="/bot">Hinweise für Websitebetreiber</Link>
        </nav>
      </div>
      <div className="container footer__legal">
        <p>
          KaufCheck ist ein unabhängiges Angebot und steht in keiner Verbindung zur Kleinanzeigen
          GmbH. Alle Angaben ohne Gewähr.
        </p>
      </div>
    </footer>
  );
}

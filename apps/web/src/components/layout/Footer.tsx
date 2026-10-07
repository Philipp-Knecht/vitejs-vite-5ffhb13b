import {
  CANCEL_BUTTON_LABEL,
  CANCEL_PATH,
  TERMS_PATH,
  WITHDRAW_BUTTON_LABEL,
  WITHDRAW_PATH,
  WITHDRAWAL_POLICY_PATH,
} from '@kaufcheck/shared';
import { Link } from 'react-router';
import { useConfig } from '../../api/queries';
import { openPrivacySettings } from '../../lib/adsense';
import { privacySignal } from '../../lib/privacy-signals';
import { ButtonLink } from '../ui/Button';
import { Logo } from './Logo';

/** Reopens Google's consent dialog (required while AdSense is active). */
function PrivacySettingsButton() {
  // The configuration only exists in the browser (never while prerendering).
  const ads = useConfig().data?.ads ?? null;
  if (!ads || privacySignal()) return null;
  return (
    <button type="button" className="link-button" onClick={() => openPrivacySettings(ads.client)}>
      Datenschutz- und Cookie-Einstellungen
    </button>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo />
          <p>
            KaufCheck bündelt die Suche auf den großen Gebrauchtwagenbörsen, ordnet Inserate, zeigt
            fehlende Angaben und hilft dir, die richtigen Fragen zu stellen. Eine Besichtigung oder
            Prüfung durch eine Fachwerkstatt ersetzt das nicht.
          </p>
        </div>
        <nav className="footer__column" aria-label="Produkt">
          <p className="footer__heading">KaufCheck</p>
          <Link to="/auto-finden">Auto finden</Link>
          <Link to="/inserat-pruefen">Inserat prüfen</Link>
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
          <PrivacySettingsButton />
          <Link to={TERMS_PATH}>AGB</Link>
          <Link to={WITHDRAWAL_POLICY_PATH}>Widerrufsbelehrung</Link>
          <Link to="/bot">Hinweise für Websitebetreiber</Link>
        </nav>
      </div>
      {/* Always available on every page: §§ 312k and 356a BGB. */}
      <div className="container footer__contracts">
        <ButtonLink to={CANCEL_PATH} variant="secondary" size="sm">
          {CANCEL_BUTTON_LABEL}
        </ButtonLink>
        <ButtonLink to={WITHDRAW_PATH} variant="secondary" size="sm">
          {WITHDRAW_BUTTON_LABEL}
        </ButtonLink>
      </div>
      <div className="container footer__legal">
        <p>
          KaufCheck ist ein unabhängiges Angebot und steht in keiner Verbindung zu mobile.de,
          AutoScout24, Kleinanzeigen, eBay oder anderen Plattformen. Alle Angaben ohne Gewähr.
        </p>
      </div>
    </footer>
  );
}

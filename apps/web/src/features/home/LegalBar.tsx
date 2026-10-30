import {
  CANCEL_BUTTON_LABEL,
  CANCEL_PATH,
  TERMS_PATH,
  WITHDRAW_BUTTON_LABEL,
  WITHDRAW_PATH,
} from '@kaufcheck/shared';
import { Link } from 'react-router';
import { PrivacySettingsButton } from '../../components/layout/Footer';

/**
 * The start page has no footer, but these stay one tap away on every page:
 * imprint and privacy (§ 5 DDG, Art. 13 GDPR), cancelling and withdrawing a
 * contract (§§ 312k, 356a BGB) and, while ads run, the consent settings.
 */
export function LegalBar() {
  return (
    <footer className="legal-bar">
      <nav className="legal-bar__links" aria-label="Rechtliches">
        <Link to="/impressum">Impressum</Link>
        <Link to="/datenschutz">Datenschutz</Link>
        <Link to={TERMS_PATH}>AGB</Link>
        <PrivacySettingsButton />
        <span className="legal-bar__contracts">
          <Link to={CANCEL_PATH} className="legal-bar__contract">
            {CANCEL_BUTTON_LABEL}
          </Link>
          <Link to={WITHDRAW_PATH} className="legal-bar__contract">
            {WITHDRAW_BUTTON_LABEL}
          </Link>
        </span>
      </nav>
    </footer>
  );
}

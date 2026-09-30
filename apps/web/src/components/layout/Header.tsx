import { Menu, UserRound, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { useMe } from '../../api/queries';
import { cn } from '../../lib/format';
import { Logo } from './Logo';

const NAV = [
  { to: '/', label: 'Inserat prüfen', end: true },
  { to: '/meine-angebote', label: 'Meine Angebote' },
  { to: '/gebrauchtwagen-kaufen', label: 'Ratgeber' },
  { to: '/pro', label: 'Pro' },
];

const GUIDES = [
  { to: '/gebrauchtwagen-kaufen', label: 'Gebrauchtwagen kaufen' },
  { to: '/gebrauchtwagen-checkliste', label: 'Checkliste Gebrauchtwagen' },
  { to: '/auto-besichtigung-checkliste', label: 'Checkliste Besichtigung' },
];

function AccountLink({ onNavigate }: { onNavigate?: () => void }) {
  const me = useMe();
  // Nothing until the session is known – avoids flashing the wrong state.
  if (!me.data) return <span className="header__account-placeholder" aria-hidden />;
  if (me.data.user) {
    return (
      <Link to="/konto" className="btn btn--ghost btn--sm header__account" onClick={onNavigate}>
        <UserRound aria-hidden size={18} />
        <span>Konto</span>
      </Link>
    );
  }
  return (
    <Link
      to="/anmelden"
      className="btn btn--secondary btn--sm header__account"
      onClick={onNavigate}
    >
      <span>Anmelden</span>
    </Link>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const close = () => setOpen(false);

  return (
    <header className="header">
      <div className="container header__bar">
        <Link
          to="/"
          className="header__logo"
          aria-label="KaufCheck – zur Startseite"
          onClick={close}
        >
          <Logo />
        </Link>
        <nav className="header__nav" aria-label="Hauptnavigation">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn('header__link', isActive && 'header__link--active')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header__actions">
          <AccountLink />
          <button
            type="button"
            className="icon-button header__menu-button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden size={22} /> : <Menu aria-hidden size={22} />}
          </button>
        </div>
      </div>
      <div id={menuId} className={cn('mobile-menu', open && 'mobile-menu--open')} hidden={!open}>
        <nav className="container mobile-menu__nav" aria-label="Menü">
          {NAV.filter((item) => item.to !== '/gebrauchtwagen-kaufen').map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="mobile-menu__link"
              onClick={close}
            >
              {item.label}
            </NavLink>
          ))}
          <p className="mobile-menu__heading">Ratgeber</p>
          {GUIDES.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="mobile-menu__link mobile-menu__link--sub"
              onClick={close}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

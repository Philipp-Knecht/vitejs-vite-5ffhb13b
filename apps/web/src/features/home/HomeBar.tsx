import { Menu, Sparkles, SquarePen } from 'lucide-react';
import type { RefObject } from 'react';
import { Link } from 'react-router';
import { useMe } from '../../api/queries';

/** The bar of the start page, like a chat app: menu and upgrade left, a new chat right. */
export function HomeBar({
  menuId,
  menuOpen,
  menuButton,
  onMenu,
  onNewChat,
}: {
  menuId: string;
  menuOpen: boolean;
  menuButton: RefObject<HTMLButtonElement | null>;
  onMenu: () => void;
  /** Null while the conversation is empty. */
  onNewChat: (() => void) | null;
}) {
  const me = useMe();
  const pro = me.data?.plan === 'pro';
  return (
    <header className="home-bar">
      <button
        ref={menuButton}
        type="button"
        className="home-bar__button"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label="Menü öffnen"
        onClick={onMenu}
      >
        <Menu aria-hidden size={22} />
      </button>
      {!pro && (
        <Link to="/pro" className="home-bar__upgrade">
          <Sparkles aria-hidden size={18} />
          <span>Upgraden</span>
        </Link>
      )}
      {onNewChat && (
        <button
          type="button"
          className="home-bar__button home-bar__new"
          aria-label="Neuer Chat"
          onClick={onNewChat}
        >
          <SquarePen aria-hidden size={20} />
        </button>
      )}
    </header>
  );
}

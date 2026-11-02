import { Menu, Sparkles, SquarePen } from 'lucide-react';
import type { RefObject } from 'react';
import { Link } from 'react-router';
import { useMe } from '../../api/queries';
import { cn } from '../../lib/format';

/**
 * The bar of the start page, like a chat app: menu and upgrade left, a new chat right.
 * Every other page has it too, staying at the top while the page scrolls.
 */
export function HomeBar({
  menuId,
  menuOpen,
  menuButton,
  onMenu,
  onNewChat,
  sticky = false,
}: {
  menuId: string;
  menuOpen: boolean;
  menuButton: RefObject<HTMLButtonElement | null>;
  onMenu: () => void;
  /** Null while the conversation is empty. */
  onNewChat: (() => void) | null;
  sticky?: boolean;
}) {
  const me = useMe();
  const pro = me.data?.plan === 'pro';
  return (
    <header className={cn('home-bar', sticky && 'home-bar--sticky')}>
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
          title="Neuer Chat"
          onClick={onNewChat}
        >
          <SquarePen aria-hidden size={20} />
        </button>
      )}
    </header>
  );
}

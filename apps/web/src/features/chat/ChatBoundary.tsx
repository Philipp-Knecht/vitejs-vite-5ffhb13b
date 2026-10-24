import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { CHAT_STORAGE_KEY } from './use-chat';

interface State {
  failed: boolean;
  attempt: number;
}

/**
 * Keeps a broken conversation (say, one an older version of the page saved)
 * from taking the start page with it: the chat starts over instead.
 */
export class ChatBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Chat failed', error, info.componentStack);
    try {
      window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // Nothing kept, nothing to clear.
    }
  }

  override render(): ReactNode {
    if (!this.state.failed)
      return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
    return (
      <div className="chat chat--failed" role="alert">
        <p>Das Gespräch ließ sich nicht anzeigen.</p>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }))}
        >
          <span>Neues Gespräch</span>
        </button>
      </div>
    );
  }
}

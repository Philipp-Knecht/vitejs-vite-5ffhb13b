import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Last line of defence: a friendly message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unexpected UI error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container page page--narrow">
        <h1>Da ist etwas schiefgelaufen</h1>
        <p>
          Diese Seite konnte nicht angezeigt werden. Lade sie bitte neu – deine gespeicherten
          Angebote sind davon nicht betroffen.
        </p>
        <p>
          <button
            type="button"
            className="btn btn--primary btn--md"
            onClick={() => window.location.reload()}
          >
            <span>Seite neu laden</span>
          </button>
        </p>
      </div>
    );
  }
}

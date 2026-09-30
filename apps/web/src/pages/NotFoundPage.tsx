import { ButtonLink } from '../components/ui/Button';
import { NOT_FOUND_META } from '../seo/pages';
import { usePageMeta } from '../seo/use-page-meta';

export function NotFoundPage() {
  usePageMeta(NOT_FOUND_META);
  return (
    <div className="container page page--narrow">
      <h1>Diese Seite gibt es nicht</h1>
      <p className="page__lead">
        Vielleicht hat sich ein Tippfehler eingeschlichen, oder die Seite wurde verschoben.
      </p>
      <div className="button-row">
        <ButtonLink to="/">Inserat prüfen</ButtonLink>
        <ButtonLink to="/gebrauchtwagen-kaufen" variant="secondary">
          Zum Ratgeber
        </ButtonLink>
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AdSlot } from '../../components/AdSlot';
import { ButtonLink } from '../../components/ui/Button';
import { STATIC_PAGE_META } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';

export interface TocEntry {
  id: string;
  title: string;
}

const GUIDES = [
  {
    to: '/gebrauchtwagen-kaufen',
    title: 'Gebrauchtwagen privat kaufen',
    text: 'Der ganze Ablauf vom Budget bis zur Zulassung.',
  },
  {
    to: '/gebrauchtwagen-checkliste',
    title: 'Gebrauchtwagen-Checkliste',
    text: 'Alle Punkte zum Abhaken und Ausdrucken.',
  },
  {
    to: '/auto-besichtigung-checkliste',
    title: 'Auto richtig besichtigen',
    text: 'Lack, Rost, Motor, Reifen und Probefahrt.',
  },
];

export function GuideLayout({
  path,
  eyebrow,
  title,
  intro,
  updated,
  toc,
  children,
}: {
  path: string;
  eyebrow: string;
  title: string;
  intro: ReactNode;
  updated: string;
  toc: TocEntry[];
  children: ReactNode;
}) {
  const meta = STATIC_PAGE_META[path];
  usePageMeta(meta ?? { title, description: '' });

  return (
    <article className="container guide">
      <nav className="breadcrumbs" aria-label="Brotkrümelnavigation">
        <ol>
          <li>
            <Link to="/">KaufCheck</Link>
          </li>
          <li>
            <span aria-current="page">{eyebrow}</span>
          </li>
        </ol>
      </nav>
      <header className="guide__header">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <div className="guide__intro">{intro}</div>
        <p className="guide__updated">Stand: {updated}</p>
      </header>

      <div className="guide__layout">
        <aside className="guide__toc">
          <nav aria-label="Inhalt">
            <p className="guide__toc-title">Inhalt</p>
            <ol>
              {toc.map((entry) => (
                <li key={entry.id}>
                  <a href={`#${entry.id}`}>{entry.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
        <div className="guide__body prose">
          {children}

          <aside className="guide-cta" aria-label="Inserat prüfen">
            <p className="guide-cta__title">Du hast schon ein Auto im Blick?</p>
            <p>
              Füge das Inserat bei KaufCheck ein: Du siehst, welche Angaben fehlen, was auffällt und
              welche Fragen du dem Verkäufer stellen solltest.
            </p>
            <ButtonLink to="/inserat-pruefen">Inserat prüfen</ButtonLink>
          </aside>

          <section className="related" aria-labelledby="related-title">
            <h2 id="related-title">Weitere Ratgeber</h2>
            <ul className="guide-cards guide-cards--compact">
              {GUIDES.filter((guide) => guide.to !== path).map((guide) => (
                <li key={guide.to}>
                  <Link to={guide.to} className="guide-card">
                    <span className="guide-card__title">{guide.title}</span>
                    <span className="guide-card__text">{guide.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <p className="guide__disclaimer">
            Dieser Ratgeber gibt allgemeine Hinweise und ersetzt keine Rechtsberatung und keine
            technische Prüfung des Fahrzeugs.
          </p>
          <AdSlot placement="guide_bottom" />
        </div>
      </div>
    </article>
  );
}

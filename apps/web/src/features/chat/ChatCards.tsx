import { PRICE_VERDICT_LABELS, type ChatCard } from '@kaufcheck/shared';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { ButtonLink } from '../../components/ui/Button';
import { formatEuro } from '../../lib/format';
import { ChatForm } from './ChatForm';
import { safeHref } from './safe-href';

const euroCents = (value: number) =>
  `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00A0€`;

function InternalLink({ href, children }: { href: string; children: string }) {
  const safe = safeHref(href);
  return safe ? <Link to={safe}>{children}</Link> : null;
}

/** One result of the assistant's tools, built by the server from KaufCheck's own data. */
export function ChatCardView({
  card,
  busy,
  onSubmit,
}: {
  card: ChatCard;
  busy: boolean;
  onSubmit: (message: string) => void;
}) {
  switch (card.type) {
    case 'analysis':
      return (
        <article className="chat-card chat-card--analysis">
          <p className="chat-card__eyebrow">Prüfung</p>
          <h3 className="chat-card__title">{card.title}</h3>
          {card.priceDisplay && <p className="chat-card__price">{card.priceDisplay}</p>}
          {card.advice && (
            <div className={`chat-card__advice chat-card__advice--${card.advice.action}`}>
              <p className="chat-card__advice-title">
                {card.verdict && card.advice.action !== 'caution'
                  ? `${PRICE_VERDICT_LABELS[card.verdict]}: `
                  : ''}
                {card.advice.title}
              </p>
              <p>{card.advice.text}</p>
              {card.advice.targetPriceEur !== null && (
                <p>
                  Zielpreis: <strong>etwa {formatEuro(card.advice.targetPriceEur)}</strong>
                </p>
              )}
            </div>
          )}
          {card.warnings.length > 0 && (
            <>
              <p className="chat-card__label">Darauf achten</p>
              <ul className="chat-card__list">
                {card.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </>
          )}
          {card.questions.length > 0 && (
            <>
              <p className="chat-card__label">Frag den Verkäufer</p>
              <ul className="chat-card__list">
                {card.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </>
          )}
          <ButtonLink to={`/analyse/${encodeURIComponent(card.analysisId)}`} size="sm">
            Ganze Prüfung öffnen
          </ButtonLink>
        </article>
      );
    case 'search':
      return (
        <article className="chat-card">
          <p className="chat-card__eyebrow">Suche</p>
          <h3 className="chat-card__title">{card.summary}</h3>
          <p className="chat-card__hint">
            Die Angebote siehst du direkt bei den Börsen; KaufCheck ruft sie nicht ab.
          </p>
          <ul className="chat-card__links">
            {card.links.map((link) => (
              <li key={link.name}>
                <a href={link.url} target="_blank" rel="noopener noreferrer nofollow">
                  {link.name} <ExternalLink aria-hidden size={14} />
                  <span className="visually-hidden"> (öffnet in neuem Tab)</span>
                </a>
                {link.applied.length > 0 && (
                  <span className="chat-card__applied"> mit {link.applied.join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
          <InternalLink href={card.findUrl}>Suche bei KaufCheck anpassen</InternalLink>
        </article>
      );
    case 'tax':
      return (
        <article className="chat-card">
          <p className="chat-card__eyebrow">Kfz-Steuer</p>
          <p className="chat-card__figure">
            {card.annualEur !== null
              ? `${formatEuro(card.annualEur)} im Jahr`
              : `Steuerfrei${card.exemptUntil ? ` bis ${card.exemptUntil.split('-').reverse().join('.')}` : ''}`}
          </p>
          <dl className="chat-card__facts">
            {card.inputs.map((input) => (
              <div key={input.label}>
                <dt>{input.label}</dt>
                <dd>{input.value}</dd>
              </div>
            ))}
          </dl>
          <p className="chat-card__hint">
            {card.rule} Verbindlich setzt das Hauptzollamt die Steuer fest.
          </p>
          <InternalLink href={card.calculatorUrl}>Im Steuerrechner ansehen</InternalLink>
        </article>
      );
    case 'financing':
      return (
        <article className="chat-card">
          <p className="chat-card__eyebrow">Finanzierung</p>
          <p className="chat-card__figure">{euroCents(card.monthlyRate)} im Monat</p>
          <dl className="chat-card__facts">
            <div>
              <dt>Kredit</dt>
              <dd>{formatEuro(card.amountEur)}</dd>
            </div>
            <div>
              <dt>Laufzeit</dt>
              <dd>{card.months} Monate</dd>
            </div>
            <div>
              <dt>Effektiver Jahreszins</dt>
              <dd>{card.ratePercent.toLocaleString('de-DE')}&nbsp;%</dd>
            </div>
            <div>
              <dt>Zinsen gesamt</dt>
              <dd>{euroCents(card.totalInterest)}</dd>
            </div>
          </dl>
          {card.averageRate && (
            <p className="chat-card__hint">
              Mit dem Durchschnittszins der Bundesbank für Konsumentenkredite – ein Beispiel, kein
              Angebot. KaufCheck vermittelt keine Kredite.
            </p>
          )}
          <InternalLink href={card.calculatorUrl}>Mit eigenen Werten rechnen</InternalLink>
        </article>
      );
    case 'model':
      return (
        <article className="chat-card">
          <p className="chat-card__eyebrow">Modellwissen</p>
          <h3 className="chat-card__title">
            {card.name}
            {card.generation ? ` – ${card.generation}` : ''}
          </h3>
          {card.issues.length > 0 ? (
            <ul className="chat-card__list">
              {card.issues.map((issue) => (
                <li key={issue.title}>
                  {issue.title} <span className="chat-card__applied">({issue.severity})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="chat-card__hint">
              Für diese Generation sind keine Schwachstellen erfasst.
            </p>
          )}
          <InternalLink href={card.url}>Alle Schwachstellen mit Quellen</InternalLink>
        </article>
      );
    case 'advisor':
      return (
        <article className="chat-card">
          <p className="chat-card__eyebrow">Passende Modelle</p>
          <ul className="chat-card__list">
            {card.items.map((item) => (
              <li key={item.name}>
                <InternalLink href={item.url}>{item.name}</InternalLink>: {item.detail}{' '}
                <InternalLink href={item.searchUrl}>Angebote suchen</InternalLink>
              </li>
            ))}
          </ul>
        </article>
      );
    case 'rdw':
      return (
        <article className="chat-card">
          <p className="chat-card__eyebrow">RDW · {card.plate}</p>
          <h3 className="chat-card__title">{card.title}</h3>
          {card.warnings.length > 0 && (
            <ul className="chat-card__list chat-card__list--warn">
              {card.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <dl className="chat-card__facts">
            {card.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <InternalLink href="/auto-aus-den-niederlanden">
            Mehr zu Autos aus den Niederlanden
          </InternalLink>
        </article>
      );
    case 'links':
      return (
        <div className="chat-card chat-card--links">
          {card.links.map((link) => {
            const safe = safeHref(link.href);
            return safe ? (
              <ButtonLink key={link.href} to={safe} size="sm" variant="secondary">
                {link.label}
              </ButtonLink>
            ) : null;
          })}
        </div>
      );
    case 'form':
      return (
        <ChatForm form={card.form} prefill={card.prefill} disabled={busy} onSubmit={onSubmit} />
      );
  }
}

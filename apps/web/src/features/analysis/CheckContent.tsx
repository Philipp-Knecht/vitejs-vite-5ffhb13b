import { PLATFORM_NAMES } from '@kaufcheck/shared';
import { CHECK_FEATURES, SUPPORTED_PLATFORMS } from './check-content';

export function FeatureGrid() {
  return (
    <div className="feature-grid">
      {CHECK_FEATURES.map(({ icon: Icon, title, text }) => (
        <article key={title} className="feature">
          <Icon className="feature__icon" aria-hidden size={24} />
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}

export function PlatformChips({ titleId }: { titleId: string }) {
  return (
    <div className="hero__platforms">
      <p id={titleId} className="hero__platforms-title">
        Funktioniert mit Inseraten von
      </p>
      <ul aria-labelledby={titleId}>
        {SUPPORTED_PLATFORMS.map((platform) => (
          <li key={platform}>{PLATFORM_NAMES[platform]}</li>
        ))}
        <li>und jeder anderen Seite</li>
      </ul>
    </div>
  );
}

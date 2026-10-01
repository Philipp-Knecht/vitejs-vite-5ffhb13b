/**
 * Google AdSense, loaded on demand. The script also brings Google's
 * certified consent dialog (Privacy & messaging): ads and cookies follow the
 * visitor's choice there. Pages carry a nonce-based Content-Security-Policy
 * with 'strict-dynamic', which trusts scripts added by our own code.
 */
declare global {
  interface Window {
    adsbygoogle?: unknown[];
    googlefc?: { callbackQueue?: unknown[]; showRevocationMessage?: () => void };
  }
}

let loadedFor: string | null = null;

export function loadAdSense(client: string): void {
  if (typeof document === 'undefined' || loadedFor === client) return;
  loadedFor = client;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.append(script);
}

/** Requests an ad for one `<ins class="adsbygoogle">` element. */
export function requestAd(): void {
  try {
    (window.adsbygoogle = window.adsbygoogle ?? []).push({});
  } catch {
    // AdSense reports problems itself; a missing ad must never break the page.
  }
}

/** Reopens Google's consent dialog so the visitor can change or withdraw consent. */
export function openPrivacySettings(client: string): void {
  loadAdSense(client);
  const googlefc = (window.googlefc = window.googlefc ?? {});
  (googlefc.callbackQueue = googlefc.callbackQueue ?? []).push(() =>
    window.googlefc?.showRevocationMessage?.(),
  );
}

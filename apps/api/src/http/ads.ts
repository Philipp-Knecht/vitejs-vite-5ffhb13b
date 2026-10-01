import { randomBytes } from 'node:crypto';

/** The ads.txt line that authorises Google AdSense to sell ads on this site. */
export function adsTxt(client: string): string {
  return `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
}

export function createNonce(): string {
  return randomBytes(18).toString('base64');
}

/**
 * Content-Security-Policy for HTML pages while AdSense is active. Google
 * supports only the strict, nonce-based policy ('strict-dynamic'): scripts
 * need the per-response nonce or must be added by such a script. Ad frames,
 * images and requests come from changing Google domains, so those
 * directives allow https: – everything else stays as strict as without ads.
 */
export function adsContentSecurityPolicy(nonce: string, https: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval' https:`,
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https:",
    'frame-src https:',
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (https) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/** Adds the AdSense site verification tag and the response's nonce to a page. */
export function prepareHtml(
  html: string,
  options: { adsenseClient: string; nonce: string | null },
): string {
  let result = html.replace(
    '</head>',
    `<meta name="google-adsense-account" content="${options.adsenseClient}" />\n  </head>`,
  );
  const { nonce } = options;
  if (nonce) {
    result = result
      .replace(/<script\b/g, `<script nonce="${nonce}"`)
      .replace(/<link\b(?=[^>]*\brel="modulepreload")/g, `<link nonce="${nonce}"`);
  }
  return result;
}

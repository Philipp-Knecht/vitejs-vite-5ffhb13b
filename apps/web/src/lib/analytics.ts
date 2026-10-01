import type { AnalyticsEventName, AnalyticsProps } from '@kaufcheck/shared';
import { privacySignal } from './privacy-signals';

/**
 * First-party, privacy-conscious analytics. Events carry no identifiers and
 * only allowlisted properties. Nothing is sent when the browser signals
 * "Do Not Track" or Global Privacy Control, or when the server has analytics
 * switched off. Analysis events are recorded by the server itself.
 */
interface QueuedEvent {
  name: AnalyticsEventName;
  props?: AnalyticsProps;
}

let serverEnabled: boolean | null = null;
const queue: QueuedEvent[] = [];

const optedOut = privacySignal;

function send(event: QueuedEvent): void {
  void fetch('/api/events', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}

/** Called once the public configuration is known. */
export function configureAnalytics(enabled: boolean): void {
  serverEnabled = enabled;
  const pending = queue.splice(0, queue.length);
  if (enabled && !optedOut()) pending.forEach(send);
}

export function track(name: AnalyticsEventName, props?: AnalyticsProps): void {
  if (typeof window === 'undefined' || optedOut()) return;
  if (serverEnabled === null) {
    if (queue.length < 10) queue.push({ name, props });
    return;
  }
  if (serverEnabled) send({ name, props });
}

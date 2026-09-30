import type { Entitlements, Plan } from '@kaufcheck/shared';

/** Who is making a request: an account, an anonymous visitor, or both unknown yet. */
export interface Actor {
  userId: string | null;
  email: string | null;
  anonymousId: string | null;
  plan: Plan;
  entitlements: Entitlements;
}

export function usageSubject(
  actor: Actor,
): { subjectType: 'user' | 'anonymous'; subjectId: string } | null {
  if (actor.userId) return { subjectType: 'user', subjectId: actor.userId };
  if (actor.anonymousId) return { subjectType: 'anonymous', subjectId: actor.anonymousId };
  return null;
}

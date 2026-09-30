import type { Db } from '../infrastructure/db/client';
import { isUniqueViolation } from '../infrastructure/db/client';
import type { EmailService } from '../infrastructure/email/email-service';
import { burnPasswordCheck, hashPassword, randomToken, sha256, verifyPassword } from '../lib/crypto';
import { AppError } from '../lib/errors';
import type { AnalysisRepository } from '../repositories/analysis-repository';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  plan: 'FREE' | 'PRO';
  createdAt: Date;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
  user: SessionUser;
}

const USER_SELECT = { id: true, email: true, plan: true, createdAt: true } as const;

/**
 * E-mail/password accounts with server-side sessions. Only a SHA-256 hash
 * of the session token is stored, so a database leak does not leak sessions.
 */
export class AuthService {
  constructor(
    private readonly db: Db,
    private readonly analyses: AnalysisRepository,
    private readonly email: EmailService,
    private readonly publicSiteUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get passwordResetEnabled(): boolean {
    return this.email.enabled;
  }

  async register(email: string, password: string, anonymousId: string | null): Promise<CreatedSession> {
    const passwordHash = await hashPassword(password);
    let user: SessionUser;
    try {
      user = await this.db.user.create({ data: { email, passwordHash }, select: USER_SELECT });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError('EMAIL_TAKEN');
      throw error;
    }
    if (anonymousId) await this.analyses.attachAnonymousToUser(anonymousId, user.id);
    return this.createSession(user);
  }

  async login(email: string, password: string, anonymousId: string | null): Promise<CreatedSession> {
    const user = await this.db.user.findUnique({ where: { email }, select: { ...USER_SELECT, passwordHash: true } });
    if (!user) {
      await burnPasswordCheck(password);
      throw new AppError('INVALID_CREDENTIALS');
    }
    if (!(await verifyPassword(password, user.passwordHash))) throw new AppError('INVALID_CREDENTIALS');
    if (anonymousId) await this.analyses.attachAnonymousToUser(anonymousId, user.id);
    const { passwordHash: _hash, ...sessionUser } = user;
    return this.createSession(sessionUser);
  }

  private async createSession(user: SessionUser): Promise<CreatedSession> {
    const token = randomToken(32);
    const expiresAt = new Date(this.now().getTime() + SESSION_TTL_MS);
    await this.db.session.create({ data: { tokenHash: sha256(token), userId: user.id, expiresAt } });
    return { token, expiresAt, user };
  }

  /** Resolves a session token; extends the session at most once a day (sliding expiry). */
  async resolveSession(token: string): Promise<{ user: SessionUser; expiresAt: Date; refreshed: boolean } | null> {
    if (token.length < 20 || token.length > 100) return null;
    const session = await this.db.session.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, expiresAt: true, lastUsedAt: true, user: { select: USER_SELECT } },
    });
    const now = this.now();
    if (!session) return null;
    if (session.expiresAt <= now) {
      await this.db.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    if (now.getTime() - session.lastUsedAt.getTime() > SESSION_REFRESH_AFTER_MS) {
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
      await this.db.session.update({ where: { id: session.id }, data: { lastUsedAt: now, expiresAt } });
      return { user: session.user, expiresAt, refreshed: true };
    }
    return { user: session.user, expiresAt: session.expiresAt, refreshed: false };
  }

  async logout(token: string): Promise<void> {
    await this.db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }

  /** Always resolves the same way, whether or not the address has an account. */
  async requestPasswordReset(email: string): Promise<void> {
    if (!this.email.enabled) throw new AppError('SERVICE_UNAVAILABLE', { message: 'Das Zurücksetzen des Passworts ist derzeit nicht verfügbar.' });
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) return;
    const token = randomToken(32);
    await this.db.passwordResetToken.create({
      data: { tokenHash: sha256(token), userId: user.id, expiresAt: new Date(this.now().getTime() + RESET_TOKEN_TTL_MS) },
    });
    const link = `${this.publicSiteUrl}/passwort-zuruecksetzen?token=${encodeURIComponent(token)}`;
    await this.email.send({
      to: user.email,
      subject: 'KaufCheck: Passwort zurücksetzen',
      text: [
        'Hallo,',
        '',
        'du hast angefordert, dein KaufCheck-Passwort zurückzusetzen. Über diesen Link kannst du innerhalb einer Stunde ein neues Passwort festlegen:',
        '',
        link,
        '',
        'Wenn du das nicht warst, kannst du diese E-Mail ignorieren – dein Passwort bleibt unverändert.',
        '',
        'Viele Grüße',
        'KaufCheck',
      ].join('\n'),
    });
  }

  async confirmPasswordReset(token: string, password: string): Promise<void> {
    const record = await this.db.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!record || record.usedAt || record.expiresAt <= this.now()) {
      throw new AppError('VALIDATION_ERROR', { message: 'Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.' });
    }
    const passwordHash = await hashPassword(password);
    await this.db.$transaction([
      this.db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: this.now() } }),
      // Sign out everywhere after a reset.
      this.db.session.deleteMany({ where: { userId: record.userId } }),
    ]);
  }

  async verifyPasswordForUser(userId: string, password: string): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    return user ? verifyPassword(password, user.passwordHash) : false;
  }
}

import type { Db } from '../infrastructure/db/client';
import type { BillingService } from '../infrastructure/billing/billing-service';
import { AppError } from '../lib/errors';
import type { AuthService } from './auth-service';

export class AccountService {
  constructor(
    private readonly db: Db,
    private readonly auth: AuthService,
    private readonly billing: BillingService,
  ) {}

  /**
   * Deletes the account and everything that belongs to it (sessions,
   * analyses, saved listings, subscription record). Requires the password.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    if (!(await this.auth.verifyPasswordForUser(userId, password))) {
      throw new AppError('INVALID_CREDENTIALS', { message: 'Das Passwort ist nicht korrekt.' });
    }
    await this.billing.cancelForAccountDeletion(userId);
    await this.db.user.delete({ where: { id: userId } });
  }
}

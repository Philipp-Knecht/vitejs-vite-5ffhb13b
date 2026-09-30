import { createTransport, type Transporter } from 'nodemailer';
import type { FastifyBaseLogger } from 'fastify';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailService {
  readonly enabled: boolean;
  send(message: EmailMessage): Promise<void>;
}

/** No e-mail configured: features that need e-mail (password reset) are disabled. */
export class DisabledEmailService implements EmailService {
  readonly enabled = false;
  send(): Promise<void> {
    return Promise.reject(new Error('E-mail is not configured'));
  }
}

export class SmtpEmailService implements EmailService {
  readonly enabled = true;
  private readonly transport: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transport = createTransport(smtpUrl);
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

/**
 * DEVELOPMENT ONLY: writes e-mails to the server log instead of sending
 * them, so the password-reset flow can be tried locally. Rejected in
 * production by the configuration.
 */
export class ConsoleEmailService implements EmailService {
  readonly enabled = true;
  constructor(private readonly logger: FastifyBaseLogger) {}

  send(message: EmailMessage): Promise<void> {
    this.logger.info(
      { op: 'email.dev', to: '[dev]', subject: message.subject },
      `DEV E-MAIL\n${message.text}`,
    );
    return Promise.resolve();
  }
}

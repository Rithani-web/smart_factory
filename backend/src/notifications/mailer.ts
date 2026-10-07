import { Resend } from 'resend';

import { env } from '../shared/env.ts';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

/** Outbound email port (research D4). Failing sends THROW — callers record
 * the outcome as a Notification row (FR-010). */
export interface Mailer {
  send(msg: MailMessage): Promise<void>;
}

export class ResendMailer implements Mailer {
  private client: Resend | null = null;

  async send(msg: MailMessage): Promise<void> {
    if (!this.client) {
      this.client = new Resend(env.RESEND_API_KEY);
    }
    const result = await this.client.emails.send({
      from: env.MAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    });
    if (result.error) {
      throw new Error(`Resend delivery failed: ${result.error.message}`);
    }
  }
}

export const mailer: Mailer = new ResendMailer();

/** Test seam (research D4): swap the process-wide mailer. */
let active: Mailer = mailer;
export function setMailer(m: Mailer): void {
  active = m;
}
export function getMailer(): Mailer {
  return active;
}

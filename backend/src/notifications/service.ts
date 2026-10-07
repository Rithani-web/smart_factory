import type { Mailer } from './mailer.ts';
import { getMailer } from './mailer.ts';
import { getPrisma } from '../shared/prisma.ts';

interface NotifiableEvent {
  id: string;
  title: string;
  severity: string;
  machineRef: string;
  description: string;
}

/** Send the assignment email and ALWAYS record the attempt against the event
 * (FR-009/FR-010). Delivery failure never breaks assignment. */
export async function recordAndSend(
  event: NotifiableEvent,
  recipient: { id: string; email: string; name: string },
  mailer: Mailer = getMailer(),
): Promise<void> {
  const html = assignmentEmailHtml(event, recipient.name);
  try {
    await mailer.send({
      to: recipient.email,
      subject: `[${event.severity}] Production event: ${event.title}`,
      html,
    });
    await getPrisma().notification.create({
      data: { eventId: event.id, recipientId: recipient.id, status: 'SENT' },
    });
  } catch (err) {
    await getPrisma().notification.create({
      data: {
        eventId: event.id,
        recipientId: recipient.id,
        status: 'FAILED',
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

function assignmentEmailHtml(event: NotifiableEvent, technicianName: string): string {
  return `
    <h2>New production event assigned</h2>
    <p>Hello ${technicianName}, you have been assigned to a production event.</p>
    <ul>
      <li><strong>Title:</strong> ${escapeHtml(event.title)}</li>
      <li><strong>Severity:</strong> ${event.severity}</li>
      <li><strong>Machine/Line:</strong> ${escapeHtml(event.machineRef)}</li>
    </ul>
    <p><strong>Description:</strong></p>
    <p>${escapeHtml(event.description)}</p>
    <p>Please acknowledge this event in the Smart Factory system.</p>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

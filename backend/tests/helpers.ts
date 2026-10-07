import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeAll, afterEach } from 'vitest';

import { ERROR_CODES, type Role } from '@smart-factory/types';

import { createApp } from '../src/app.ts';
import { setDatabaseUrl, getPrisma } from '../src/shared/prisma.ts';
import { setMailer, type Mailer } from '../src/notifications/mailer.ts';

// Point every test at the Neon test branch (course step 6). Until the user
// provisions TEST_DATABASE_URL this equals the dev database — acceptable for a
// project with no production data, and flagged in the completion report.
if (process.env.TEST_DATABASE_URL) {
  setDatabaseUrl(process.env.TEST_DATABASE_URL);
}

export const app = createApp();

export interface FakeSend {
  to: string;
  subject: string;
  html: string;
}

/** Install an in-memory Mailer and return the capture array (research D4). */
export function useFakeMailer(): FakeSend[] {
  const sends: FakeSend[] = [];
  const fake: Mailer = {
    async send(msg) {
      sends.push({ ...msg });
    },
  };
  setMailer(fake);
  return sends;
}

export const TEST_PASSWORD = 'Test#Password1';

interface SeedUser {
  id: string;
  email: string;
}

export async function seedUser(
  name: string,
  email: string,
  role: Role,
): Promise<SeedUser> {
  const db = getPrisma();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
  const user = await db.user.upsert({
    where: { email },
    update: { role, mustChangePassword: false, passwordHash },
    create: { name, email, role, passwordHash, mustChangePassword: false },
  });
  return { id: user.id, email };
}

export async function resetDb(): Promise<void> {
  const db = getPrisma();
  await db.historyEntry.deleteMany();
  await db.notification.deleteMany();
  await db.assignment.deleteMany();
  await db.dutyRosterEntry.deleteMany();
  await db.productionEvent.deleteMany();
  await db.user.deleteMany();
}

/** Clean all transactional tables between tests (keep seeded users). */
export async function cleanEvents(): Promise<void> {
  const db = getPrisma();
  await db.historyEntry.deleteMany();
  await db.notification.deleteMany();
  await db.assignment.deleteMany();
  await db.dutyRosterEntry.deleteMany();
  await db.productionEvent.deleteMany();
}

/** Login helper returning a Supertest agent with auth cookies attached. */
export async function loginAs(
  email: string,
  password: string = TEST_PASSWORD,
): Promise<request.Agent> {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`loginAs(${email}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

export async function addRosterEntry(technicianId: string): Promise<void> {
  const now = new Date();
  await getPrisma().dutyRosterEntry.create({
    data: {
      technicianId,
      startsAt: new Date(now.getTime() - 60_000),
      endsAt: new Date(now.getTime() + 60 * 60 * 1000),
    },
  });
}

export async function createEventViaApi(
  agent: request.Agent,
  overrides: Record<string, unknown> = {},
): Promise<request.Response> {
  return agent.post('/api/events').send({
    title: 'Packaging line 2 jammer fault',
    description: 'Primary jammer stopped responding; line halted.',
    machineRef: 'Line 2',
    severity: 'HIGH',
    ...overrides,
  });
}

export { ERROR_CODES, beforeAll, afterEach };

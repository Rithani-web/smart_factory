import bcrypt from 'bcryptjs';

import { getPrisma } from '../src/shared/prisma.ts';
import { DEFAULT_WINDOWS } from '../src/escalation/policies.ts';
import { DEFAULT_SLA_TARGETS } from '../src/sla/service.ts';

const DEV_PASSWORD = 'Factory#2026';

async function main(): Promise<void> {
  const db = getPrisma();
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const mkUser = (
    email: string,
    name: string,
    role: 'ADMIN' | 'TECHNICIAN' | 'VIEWER',
    mustChange = false,
  ) =>
    db.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role, passwordHash, mustChangePassword: mustChange },
    });

  const admin = await mkUser('admin@factory.local', 'Plant Admin', 'ADMIN');
  const admin2 = await mkUser('manager@factory.local', 'Production Manager', 'ADMIN');
  const tech1 = await mkUser('tech@factory.local', 'Duty Technician', 'TECHNICIAN');
  const tech2 = await mkUser('backup@factory.local', 'Backup Technician', 'TECHNICIAN');
  const tech3 = await mkUser('lineb@factory.local', 'Line B Technician', 'TECHNICIAN');
  await mkUser('viewer@factory.local', 'Floor Viewer', 'VIEWER');

  const hour = 60 * 60 * 1000;
  const now = Date.now();

  // ── Teams with staggered rotations (FR-310) ────────────────────────────────
  const lineA = await db.team.upsert({
    where: { name: 'Line A Maintenance' },
    update: {},
    create: {
      name: 'Line A Maintenance',
      cadence: 'WEEKLY',
      anchorAt: new Date(now - 2 * hour),
      escalationAdminId: admin.id,
      members: {
        create: [
          { technicianId: tech1.id, position: 0 },
          { technicianId: tech2.id, position: 1 },
        ],
      },
    },
  });
  void lineA;
  const lineB = await db.team.upsert({
    where: { name: 'Line B Maintenance' },
    update: {},
    create: {
      name: 'Line B Maintenance',
      cadence: 'DAILY',
      anchorAt: new Date(now - 5 * hour),
      escalationAdminId: admin2.id,
      members: { create: [{ technicianId: tech3.id, position: 0 }] },
    },
  });
  await db.team.upsert({
    where: { name: 'Utilities' },
    update: {},
    create: {
      name: 'Utilities',
      cadence: 'WEEKLY',
      anchorAt: new Date(now - 24 * hour),
      escalationAdminId: admin2.id,
      members: {
        create: [
          { technicianId: tech2.id, position: 0 },
          { technicianId: tech3.id, position: 1 },
        ],
      },
    },
  });

  // ── spec/002 escalation policies + spec/003 SLA targets ────────────────────
  for (const [severity, windowMinutes] of Object.entries(DEFAULT_WINDOWS)) {
    await db.escalationPolicy.upsert({
      where: { severity: severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' },
      update: {},
      create: { severity: severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW', windowMinutes },
    });
  }
  for (const [severity, t] of Object.entries(DEFAULT_SLA_TARGETS)) {
    await db.slaTarget.upsert({
      where: { severity: severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' },
      update: {},
      create: {
        severity: severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
        ackMinutes: t.ackMinutes,
        resolveMinutes: t.resolveMinutes,
      },
    });
  }

  // ── Demo events across states and severities (FR-310) ─────────────────────
  const existing = await db.productionEvent.count();
  if (existing === 0) {
    // 1. OPEN CRITICAL, reported 30 min ago → ack SLA BREACHED right now.
    await db.productionEvent.create({
      data: {
        title: 'Furnace zone 3 overtemperature',
        description: 'Zone 3 exceeded 720°C; line halted pending inspection.',
        machineRef: 'Furnace 1',
        severity: 'CRITICAL',
        status: 'ASSIGNED',
        reporterId: admin.id,
        createdAt: new Date(now - 30 * 60_000),
        ackDeadline: new Date(now + 5 * 60_000),
        assignments: { create: { technicianId: tech1.id, active: true } },
        history: {
          create: [
            { action: 'CREATED', actorId: admin.id, createdAt: new Date(now - 30 * 60_000) },
            {
              action: 'ASSIGNED',
              actorId: admin.id,
              detail: tech1.name,
              createdAt: new Date(now - 30 * 60_000),
            },
          ],
        },
      },
    });

    // 2. ACKNOWLEDGED HIGH, reported 20 min ago, acked after 8 min (ack SLA breached for HIGH=15? no — 8<15 MET).
    await db.productionEvent.create({
      data: {
        title: 'Conveyor 2 drive vibration',
        description: 'Unusual vibration on the main drive bearing.',
        machineRef: 'Conveyor 2',
        severity: 'HIGH',
        status: 'ACKNOWLEDGED',
        reporterId: tech3.id,
        createdAt: new Date(now - 20 * 60_000),
        acknowledgedAt: new Date(now - 12 * 60_000),
        assignments: { create: { technicianId: tech3.id, active: true } },
        history: {
          create: [
            { action: 'CREATED', actorId: tech3.id, createdAt: new Date(now - 20 * 60_000) },
            {
              action: 'ASSIGNED',
              actorId: tech3.id,
              detail: tech3.name,
              createdAt: new Date(now - 20 * 60_000),
            },
            { action: 'ACKNOWLEDGED', actorId: tech3.id, createdAt: new Date(now - 12 * 60_000) },
          ],
        },
      },
    });

    // 3. RESOLVED MEDIUM (met both SLAs).
    await db.productionEvent.create({
      data: {
        title: 'Cooling pump pressure drift',
        description: 'Pressure drifted below setpoint on the secondary loop.',
        machineRef: 'Cooling Loop B',
        severity: 'MEDIUM',
        status: 'RESOLVED',
        reporterId: tech2.id,
        createdAt: new Date(now - 26 * hour),
        acknowledgedAt: new Date(now - 25 * hour),
        resolvedAt: new Date(now - 22 * hour),
        resolvedById: tech2.id,
        resolutionNotes: 'Re-primed loop and replaced the pressure sensor.',
        assignments: { create: { technicianId: tech2.id, active: false } },
        history: {
          create: [
            { action: 'CREATED', actorId: tech2.id, createdAt: new Date(now - 26 * hour) },
            { action: 'ASSIGNED', actorId: tech2.id, createdAt: new Date(now - 26 * hour) },
            { action: 'ACKNOWLEDGED', actorId: tech2.id, createdAt: new Date(now - 25 * hour) },
            { action: 'RESOLVED', actorId: tech2.id, createdAt: new Date(now - 22 * hour) },
          ],
        },
      },
    });

    // 4. RESOLVED LOW, older window.
    await db.productionEvent.create({
      data: {
        title: 'Label printer paper jam',
        description: 'Packaging label printer jammed twice.',
        machineRef: 'Packing 1',
        severity: 'LOW',
        status: 'RESOLVED',
        reporterId: admin.id,
        createdAt: new Date(now - 5 * 24 * hour),
        acknowledgedAt: new Date(now - 5 * 24 * hour + 2 * hour),
        resolvedAt: new Date(now - 5 * 24 * hour + 3 * hour),
        resolvedById: tech1.id,
        resolutionNotes: 'Cleared jam, replaced paper roll.',
        history: {
          create: [
            { action: 'CREATED', actorId: admin.id, createdAt: new Date(now - 5 * 24 * hour) },
            { action: 'RESOLVED', actorId: tech1.id, createdAt: new Date(now - 5 * 24 * hour + 3 * hour) },
          ],
        },
      },
    });

    // 5. OPEN LOW, fresh (operational noise).
    await db.productionEvent.create({
      data: {
        title: 'Air line hiss near station 4',
        description: 'Faint hiss suspected from a worn fitting.',
        machineRef: 'Station 4',
        severity: 'LOW',
        status: 'OPEN',
        reporterId: tech2.id,
        createdAt: new Date(now - 10 * 60_000),
        history: {
          create: [{ action: 'CREATED', actorId: tech2.id, createdAt: new Date(now - 10 * 60_000) }],
        },
      },
    });
  }

  // ── Manual status override example (spec/004) ──────────────────────────────
  await db.statusMessage.upsert({
    where: { teamId: lineB.id },
    update: {},
    create: {
      teamId: lineB.id,
      message: 'Planned maintenance scheduled for Production Line B this weekend.',
      authorId: admin2.id,
    },
  });

  console.log('Seeded users (password Factory#2026 unless noted):');
  console.log('  ADMIN      admin@factory.local · manager@factory.local');
  console.log('  TECHNICIAN tech@factory.local · backup@factory.local · lineb@factory.local');
  console.log('  VIEWER     viewer@factory.local');
  console.log('Seeded 3 teams (rotations), policies, SLA targets, 5 demo events,');
  console.log('  1 SLA-breached open CRITICAL, 1 manual status message on Line B.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => getPrisma().$disconnect());

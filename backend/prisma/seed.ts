import bcrypt from 'bcryptjs';

import { getPrisma } from '../src/shared/prisma.ts';
import { DEFAULT_WINDOWS } from '../src/escalation/policies.ts';
import { DEFAULT_SLA_TARGETS } from '../src/sla/service.ts';

const DEV_PASSWORD = 'Factory#2026';

async function main(): Promise<void> {
  const db = getPrisma();
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const admin = await db.user.upsert({
    where: { email: 'admin@factory.local' },
    update: {},
    create: {
      name: 'Plant Admin',
      email: 'admin@factory.local',
      role: 'ADMIN',
      passwordHash,
      mustChangePassword: false,
    },
  });
  const technician = await db.user.upsert({
    where: { email: 'tech@factory.local' },
    update: {},
    create: {
      name: 'Duty Technician',
      email: 'tech@factory.local',
      role: 'TECHNICIAN',
      passwordHash,
      mustChangePassword: false,
    },
  });
  const backup = await db.user.upsert({
    where: { email: 'backup@factory.local' },
    update: {},
    create: {
      name: 'Backup Technician',
      email: 'backup@factory.local',
      role: 'TECHNICIAN',
      passwordHash,
      mustChangePassword: false,
    },
  });
  await db.user.upsert({
    where: { email: 'viewer@factory.local' },
    update: {},
    create: {
      name: 'Floor Viewer',
      email: 'viewer@factory.local',
      role: 'VIEWER',
      passwordHash,
      mustChangePassword: false,
    },
  });

  // spec/002: rotation team (anchor 1h ago → position 0 = Duty Technician now).
  const anchor = new Date(Date.now() - 60 * 60 * 1000);
  const team = await db.team.upsert({
    where: { name: 'Line Maintenance' },
    update: {},
    create: {
      name: 'Line Maintenance',
      cadence: 'WEEKLY',
      anchorAt: anchor,
      escalationAdminId: admin.id,
      members: {
        create: [
          { technicianId: technician.id, position: 0 },
          { technicianId: backup.id, position: 1 },
        ],
      },
    },
  });
  // Keep the demo team's rotation pointing at position 0 even on reseed weeks.
  await db.team.update({ where: { id: team.id }, data: { anchorAt: anchor } });

  // spec/002: escalation policies (FR-106 defaults).
  for (const [severity, windowMinutes] of Object.entries(DEFAULT_WINDOWS)) {
    await db.escalationPolicy.upsert({
      where: { severity: severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' },
      update: { windowMinutes },
      create: {
        severity: severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
        windowMinutes,
      },
    });
  }

  // spec/003: SLA targets (clarified Q1 defaults).
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

  console.log('Seeded users:');
  console.log(`  ADMIN      admin@factory.local / ${DEV_PASSWORD}`);
  console.log(`  TECHNICIAN tech@factory.local / ${DEV_PASSWORD}`);
  console.log(`  TECHNICIAN backup@factory.local / ${DEV_PASSWORD}`);
  console.log(`  VIEWER     viewer@factory.local / ${DEV_PASSWORD}`);
  console.log(`Seeded team "${team.name}" (weekly rotation, anchor 1h ago) + policies.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => getPrisma().$disconnect());

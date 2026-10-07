import bcrypt from 'bcryptjs';

import { getPrisma } from '../src/shared/prisma.ts';

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

  // Roster entry covering "now" so US3 auto-assignment works out of the box.
  const now = new Date();
  const existing = await db.dutyRosterEntry.findFirst({
    where: { technicianId: technician.id, startsAt: { lte: now }, endsAt: { gt: now } },
  });
  if (!existing) {
    await db.dutyRosterEntry.create({
      data: {
        technicianId: technician.id,
        startsAt: new Date(now.getTime() - 60 * 60 * 1000),
        endsAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
      },
    });
  }

  console.log('Seeded users:');
  console.log(`  ADMIN      admin@factory.local / ${DEV_PASSWORD}`);
  console.log(`  TECHNICIAN tech@factory.local / ${DEV_PASSWORD}`);
  console.log(`  VIEWER     viewer@factory.local / ${DEV_PASSWORD}`);
  console.log(`Seeded duty roster for technician ${technician.name} (actor ${admin.name}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => getPrisma().$disconnect());

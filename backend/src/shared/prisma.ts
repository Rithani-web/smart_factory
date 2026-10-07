import { PrismaClient } from '@prisma/client';

import { env } from './env.ts';

let client: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL ?? env.DATABASE_URL } },
    });
  }
  return client;
}

/** Test support: point the singleton at a (test) database before first use. */
export function setDatabaseUrl(url: string): void {
  if (client) {
    throw new Error('setDatabaseUrl must be called before the first getPrisma()');
  }
  process.env.DATABASE_URL = url;
}

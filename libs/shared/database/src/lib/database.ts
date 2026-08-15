import { PrismaPg } from '@prisma/adapter-pg';

import {
  PrismaClient,
} from '../generated/prisma/client.js';

import {
  getDatabaseConfig,
} from '@gurusthalam/config';

export function createPrismaClient(): PrismaClient {
  const databaseConfig =
    getDatabaseConfig();

  const adapter = new PrismaPg({
    connectionString:
      databaseConfig.uri,
  });

  return new PrismaClient({
    adapter,
  });
}
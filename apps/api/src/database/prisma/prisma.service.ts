import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaPg } from '@prisma/adapter-pg';

import { getDatabaseConfig } from '@gurusthalam/config';

import {
  PrismaClient,
} from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private connected = false;

  constructor() {
    const databaseConfig = getDatabaseConfig();

    const adapter = new PrismaPg({
      connectionString: databaseConfig.uri,
    });

    super({
      adapter,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.connected = true;
  }

  async onModuleDestroy(): Promise<void> {
    this.connected = false;
    await this.$disconnect();
  }

  isConnected(): boolean {
    return this.connected;
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
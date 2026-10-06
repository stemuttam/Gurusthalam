import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../../database.module.js';

import { PrismaService } from '../../prisma.service.js';

import {
  ENTITLEMENT_REPOSITORY,
  ENROLLMENT_REPOSITORY,
} from './learning-repository.tokens.js';

import { PrismaEntitlementRepository } from './prisma-entitlement.repository.js';

import { PrismaEnrollmentRepository } from './prisma-enrollment.repository.js';

@Module({
  imports: [DatabaseModule],

  providers: [
    {
      provide: ENROLLMENT_REPOSITORY,

      inject: [PrismaService],

      useFactory: (prisma: PrismaService): PrismaEnrollmentRepository =>
        new PrismaEnrollmentRepository(prisma),
    },

    {
      provide: ENTITLEMENT_REPOSITORY,

      inject: [PrismaService],

      useFactory: (prisma: PrismaService): PrismaEntitlementRepository =>
        new PrismaEntitlementRepository(prisma),
    },
  ],

  exports: [ENROLLMENT_REPOSITORY, ENTITLEMENT_REPOSITORY],
})
export class LearningPersistenceModule {}

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../../database.module.js';

import { PrismaService } from '../../prisma.service.js';

import { PrismaEnrollmentRepository } from './prisma-enrollment.repository.js';

import { ENROLLMENT_REPOSITORY } from './learning-repository.tokens.js';

@Module({
  imports: [DatabaseModule],

  providers: [
    {
      provide: ENROLLMENT_REPOSITORY,

      inject: [PrismaService],

      useFactory: (prisma: PrismaService): PrismaEnrollmentRepository =>
        new PrismaEnrollmentRepository(prisma),
    },
  ],

  exports: [ENROLLMENT_REPOSITORY],
})
export class LearningPersistenceModule {}

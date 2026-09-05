import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  Test,
} from '@nestjs/testing';

import {
  DefaultCourseApplicationService,
} from '@gurusthalam/courses';

import {
  PrismaService,
} from '../database/prisma/prisma.service.js';

import {
  CoursesApplicationModule,
} from './courses-application.module.js';

describe(
  'CoursesApplicationModule',
  () => {
    const createTestingModule =
      async () =>
        Test
          .createTestingModule({
            imports: [
              CoursesApplicationModule,
            ],
          })
          .overrideProvider(
            PrismaService,
          )
          .useValue({})
          .compile();

    it(
      'resolves the Course application service',
      async () => {
        const moduleRef =
          await createTestingModule();

        const service =
          moduleRef.get(
            DefaultCourseApplicationService,
          );

        expect(
          service,
        ).toBeInstanceOf(
          DefaultCourseApplicationService,
        );

        await moduleRef.close();
      },
    );

    it(
      'resolves the Course application service as a singleton',
      async () => {
        const moduleRef =
          await createTestingModule();

        const first =
          moduleRef.get(
            DefaultCourseApplicationService,
          );

        const second =
          moduleRef.get(
            DefaultCourseApplicationService,
          );

        expect(first).toBe(second);

        await moduleRef.close();
      },
    );
  },
);
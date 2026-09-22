import { describe, expect, it } from 'vitest';

import { Test } from '@nestjs/testing';

import {
  DefaultCourseApplicationService,
  DefaultCourseVersionApplicationService,
} from '@gurusthalam/courses';

import { PrismaService } from '../database/prisma/prisma.service.js';

import {
  CourseController,
  CourseVersionController,
} from './course.controller.js';
import { CoursesApplicationModule } from './courses-application.module.js';

describe('Course API integration regression', () => {
  const createTestingModule = async () =>
    Test.createTestingModule({
      imports: [CoursesApplicationModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

  it('resolves CourseController through CoursesApplicationModule', async () => {
    const moduleRef = await createTestingModule();

    const controller = moduleRef.get(CourseController);

    expect(controller).toBeInstanceOf(CourseController);

    await moduleRef.close();
  });

  it('resolves CourseVersionController through CoursesApplicationModule', async () => {
    const moduleRef = await createTestingModule();

    const controller = moduleRef.get(CourseVersionController);

    expect(controller).toBeInstanceOf(CourseVersionController);

    await moduleRef.close();
  });

  it('injects the Course application service into CourseController', async () => {
    const moduleRef = await createTestingModule();

    const controller = moduleRef.get(CourseController);

    const applicationService = moduleRef.get(DefaultCourseApplicationService);

    expect(controller).toBeDefined();
    expect(applicationService).toBeInstanceOf(DefaultCourseApplicationService);

    await moduleRef.close();
  });

  it('injects the CourseVersion application service into CourseController', async () => {
    const moduleRef = await createTestingModule();

    const controller = moduleRef.get(CourseController);

    const applicationService = moduleRef.get(
      DefaultCourseVersionApplicationService,
    );

    expect(controller).toBeDefined();
    expect(applicationService).toBeInstanceOf(
      DefaultCourseVersionApplicationService,
    );

    await moduleRef.close();
  });

  it('injects the CourseVersion application service into CourseVersionController', async () => {
    const moduleRef = await createTestingModule();

    const controller = moduleRef.get(CourseVersionController);

    const applicationService = moduleRef.get(
      DefaultCourseVersionApplicationService,
    );

    expect(controller).toBeDefined();
    expect(applicationService).toBeInstanceOf(
      DefaultCourseVersionApplicationService,
    );

    await moduleRef.close();
  });

  it('resolves both Course controllers from the same application module', async () => {
    const moduleRef = await createTestingModule();

    const courseController = moduleRef.get(CourseController);
    const courseVersionController = moduleRef.get(CourseVersionController);

    expect(courseController).toBeInstanceOf(CourseController);
    expect(courseVersionController).toBeInstanceOf(CourseVersionController);

    await moduleRef.close();
  });

  it('keeps the Course application services available from the composed module', async () => {
    const moduleRef = await createTestingModule();

    const courseApplicationService = moduleRef.get(
      DefaultCourseApplicationService,
    );
    const courseVersionApplicationService = moduleRef.get(
      DefaultCourseVersionApplicationService,
    );

    expect(courseApplicationService).toBeInstanceOf(
      DefaultCourseApplicationService,
    );
    expect(courseVersionApplicationService).toBeInstanceOf(
      DefaultCourseVersionApplicationService,
    );

    await moduleRef.close();
  });
});

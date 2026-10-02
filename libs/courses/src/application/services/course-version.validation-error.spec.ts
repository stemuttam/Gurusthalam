import { describe, expect, it, vi } from 'vitest';

import { CourseValidationError } from '../../domain/errors/index.js';

import { DefaultCourseVersionApplicationService } from './course-version-application.service.js';

import { DefaultCourseVersionRollbackApplicationService } from './course-version-rollback.application.service.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import type { CourseVersionRepository } from '../../domain/repositories/course-version-repository.js';

import type { CourseVersionRollbackPersistence } from '../contracts/course-version-rollback.contracts.js';

describe('CourseVersion application validation error contract', () => {
  it('normalizes invalid CourseVersion creation input', async () => {
    const courseRepository = {
      findById: vi.fn(),
    } as unknown as CourseRepository;

    const courseVersionRepository = {
      findLatestByCourseId: vi.fn(),
      save: vi.fn(),
    } as unknown as CourseVersionRepository;

    const service = new DefaultCourseVersionApplicationService(
      courseRepository,
      courseVersionRepository,
    );

    await expect(
      service.createVersion({
        courseId: '   ',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(courseRepository.findById).not.toHaveBeenCalled();

    expect(courseVersionRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes invalid CourseVersion publication input', async () => {
    const courseRepository = {
      findById: vi.fn(),
    } as unknown as CourseRepository;

    const courseVersionRepository = {
      findById: vi.fn(),
      save: vi.fn(),
    } as unknown as CourseVersionRepository;

    const service = new DefaultCourseVersionApplicationService(
      courseRepository,
      courseVersionRepository,
    );

    await expect(
      service.publishVersion({
        courseVersionId: '   ',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(courseVersionRepository.findById).not.toHaveBeenCalled();

    expect(courseVersionRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes invalid rollback input before entering the transaction boundary', async () => {
    const execute = vi.fn();

    const persistence = {
      execute,
    } as unknown as CourseVersionRollbackPersistence;

    const service = new DefaultCourseVersionRollbackApplicationService(
      persistence,
    );

    await expect(
      service.rollback({
        courseId: '   ',
        sourceVersionId: 'source-001',
        reason: 'Rollback reason',
        actor: {
          type: 'SYSTEM',
          id: 'system',
        },
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(execute).not.toHaveBeenCalled();
  });
});

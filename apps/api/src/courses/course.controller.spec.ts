import { describe, expect, it, vi } from 'vitest';

import type {
  CourseApplicationService,
  CourseVersionApplicationService,
} from '@gurusthalam/courses';

import type {
  AssignCourseOwnershipDto,
  CreateCourseDto,
  GetCourseDto,
  RemoveCourseOwnershipDto,
  ReplaceCourseOwnershipDto,
  UpdateCourseMetadataDto,
} from './dto/index.js';

import {
  CourseController,
  CourseVersionController,
} from './course.controller.js';

describe('CourseController', () => {
  const createCourseApplicationMock = (): CourseApplicationService => ({
    createCourse: vi.fn(),
    getCourse: vi.fn(),
    courseExists: vi.fn(),
    saveCourse: vi.fn(),
    updateCourse: vi.fn(),
    updateMetadata: vi.fn(),
    assignOwnership: vi.fn(),
    removeOwnership: vi.fn(),
    replaceOwnership: vi.fn(),
    submitForReview: vi.fn(),
    requestChanges: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    archive: vi.fn(),
  });

  const createCourseVersionApplicationMock =
    (): CourseVersionApplicationService => ({
      createVersion: vi.fn(),
      publishVersion: vi.fn(),
    });

  it('delegates Course creation to the application service', async () => {
    const courseApplication = createCourseApplicationMock();

    const courseVersionApplication = createCourseVersionApplicationMock();

    const expected = {
      id: 'course-001',
    };

    vi.mocked(courseApplication.createCourse).mockResolvedValue(
      expected as never,
    );

    const controller = new CourseController(
      courseApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[0],
      courseVersionApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[1],
    );

    const request: CreateCourseDto = {
      title: 'Physics',
      description: 'Introduction to physics',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PRIVATE',
      instructorId: 'instructor-001',
    };

    const result = await controller.create(request);

    expect(courseApplication.createCourse).toHaveBeenCalledTimes(1);

    expect(courseApplication.createCourse).toHaveBeenCalledWith({
      title: 'Physics',
      description: 'Introduction to physics',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PRIVATE',
      instructorId: 'instructor-001',
      ownership: undefined,
    });

    expect(result).toBe(expected);
  });

  it('maps the Course route parameter to getCourse input', async () => {
    const courseApplication = createCourseApplicationMock();

    const courseVersionApplication = createCourseVersionApplicationMock();

    const expected = {
      id: 'course-001',
    };

    vi.mocked(courseApplication.getCourse).mockResolvedValue(expected as never);

    const controller = new CourseController(
      courseApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[0],
      courseVersionApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[1],
    );

    const params: GetCourseDto = {
      courseId: 'course-001',
    };

    const result = await controller.get(params);

    expect(courseApplication.getCourse).toHaveBeenCalledWith({
      courseId: 'course-001',
    });

    expect(result).toBe(expected);
  });

  it('maps Course metadata updates without adding transport-only fields', async () => {
    const courseApplication = createCourseApplicationMock();

    const courseVersionApplication = createCourseVersionApplicationMock();

    const expected = {
      id: 'course-001',
    };

    vi.mocked(courseApplication.updateCourse).mockResolvedValue(
      expected as never,
    );

    const controller = new CourseController(
      courseApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[0],
      courseVersionApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[1],
    );

    const request: UpdateCourseMetadataDto = {
      title: 'Updated Physics',
      description: 'Updated description',
    };

    const result = await controller.update('course-001', request);

    expect(courseApplication.updateCourse).toHaveBeenCalledWith({
      courseId: 'course-001',
      title: 'Updated Physics',
      description: 'Updated description',
    });

    expect(result).toBe(expected);
  });

  it('maps ownership assignment to the application service', async () => {
    const courseApplication = createCourseApplicationMock();

    const courseVersionApplication = createCourseVersionApplicationMock();

    vi.mocked(courseApplication.assignOwnership).mockResolvedValue({
      id: 'course-001',
    } as never);

    const controller = new CourseController(
      courseApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[0],
      courseVersionApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[1],
    );

    const request: AssignCourseOwnershipDto = {
      principalId: 'principal-001',
      role: 'OWNER',
    };

    await controller.assignOwnership('course-001', request);

    expect(courseApplication.assignOwnership).toHaveBeenCalledWith({
      courseId: 'course-001',
      principalId: 'principal-001',
      role: 'OWNER',
    });
  });

  it('maps ownership removal to the application service', async () => {
    const courseApplication = createCourseApplicationMock();

    const courseVersionApplication = createCourseVersionApplicationMock();

    vi.mocked(courseApplication.removeOwnership).mockResolvedValue({
      id: 'course-001',
    } as never);

    const controller = new CourseController(
      courseApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[0],
      courseVersionApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[1],
    );

    const request: RemoveCourseOwnershipDto = {
      principalId: 'principal-001',
      role: 'OWNER',
    };

    await controller.removeOwnership('course-001', request);

    expect(courseApplication.removeOwnership).toHaveBeenCalledWith({
      courseId: 'course-001',
      principalId: 'principal-001',
      role: 'OWNER',
    });
  });

  it('maps complete ownership replacement to the application service', async () => {
    const courseApplication = createCourseApplicationMock();

    const courseVersionApplication = createCourseVersionApplicationMock();

    vi.mocked(courseApplication.replaceOwnership).mockResolvedValue({
      id: 'course-001',
    } as never);

    const controller = new CourseController(
      courseApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[0],
      courseVersionApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[1],
    );

    const request: ReplaceCourseOwnershipDto = {
      assignments: [
        {
          principalId: 'principal-001',
          role: 'OWNER',
        },
      ],
    };

    await controller.replaceOwnership('course-001', request);

    expect(courseApplication.replaceOwnership).toHaveBeenCalledWith({
      courseId: 'course-001',
      assignments: [
        {
          principalId: 'principal-001',
          role: 'OWNER',
        },
      ],
    });
  });

  it('maps Course lifecycle commands using only the route identifier', async () => {
    const courseApplication = createCourseApplicationMock();

    const courseVersionApplication = createCourseVersionApplicationMock();

    const controller = new CourseController(
      courseApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[0],
      courseVersionApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[1],
    );

    await controller.submitForReview('course-001');

    await controller.requestChanges('course-001');

    await controller.publish('course-001');

    await controller.unpublish('course-001');

    await controller.archive('course-001');

    expect(courseApplication.submitForReview).toHaveBeenCalledWith({
      courseId: 'course-001',
    });

    expect(courseApplication.requestChanges).toHaveBeenCalledWith({
      courseId: 'course-001',
    });

    expect(courseApplication.publish).toHaveBeenCalledWith({
      courseId: 'course-001',
    });

    expect(courseApplication.unpublish).toHaveBeenCalledWith({
      courseId: 'course-001',
    });

    expect(courseApplication.archive).toHaveBeenCalledWith({
      courseId: 'course-001',
    });
  });

  it('maps CourseVersion creation to the version application service', async () => {
    const courseApplication = createCourseApplicationMock();

    const courseVersionApplication = createCourseVersionApplicationMock();

    const expected = {
      id: 'course-version-001',
    };

    vi.mocked(courseVersionApplication.createVersion).mockResolvedValue(
      expected as never,
    );

    const controller = new CourseController(
      courseApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[0],
      courseVersionApplication as unknown as ConstructorParameters<
        typeof CourseController
      >[1],
    );

    const result = await controller.createVersion('course-001');

    expect(courseVersionApplication.createVersion).toHaveBeenCalledWith({
      courseId: 'course-001',
    });

    expect(result).toBe(expected);
  });
});

describe('CourseVersionController', () => {
  it('maps CourseVersion publication to the application service', async () => {
    const courseVersionApplication: CourseVersionApplicationService = {
      createVersion: vi.fn(),
      publishVersion: vi.fn(),
    };

    const expected = {
      id: 'course-version-001',
    };

    vi.mocked(courseVersionApplication.publishVersion).mockResolvedValue(
      expected as never,
    );

    const controller = new CourseVersionController(
      courseVersionApplication as unknown as ConstructorParameters<
        typeof CourseVersionController
      >[0],
    );

    const result = await controller.publish('course-version-001');

    expect(courseVersionApplication.publishVersion).toHaveBeenCalledWith({
      courseVersionId: 'course-version-001',
    });

    expect(result).toBe(expected);
  });
});

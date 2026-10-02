import { describe, expect, it, vi } from 'vitest';

import type {
  CourseApplicationService,
  CourseQueryResultPage,
  CourseVersionApplicationService,
} from '@gurusthalam/courses';

import type {
  AssignCourseOwnershipDto,
  CreateCourseDto,
  CourseQueryDto,
  GetCourseDto,
  RemoveCourseOwnershipDto,
  ReplaceCourseOwnershipDto,
  UpdateCourseMetadataDto,
} from './dto/index.js';

import {
  CourseController,
  CourseVersionController,
} from './course.controller.js';

/**
 * Constructor argument types are derived directly from the production
 * controllers so this test remains synchronized with their dependency
 * boundaries.
 */
type CourseControllerConstructorArgs = ConstructorParameters<
  typeof CourseController
>;

type CourseVersionControllerConstructorArgs = ConstructorParameters<
  typeof CourseVersionController
>;

/**
 * The production CourseController depends on the concrete
 * DefaultCourseQueryApplicationService.
 *
 * For this HTTP-adapter unit test, a structural mock is sufficient because
 * the controller only invokes the public `search()` method. The centralized
 * cast keeps the dependency conversion out of individual tests.
 */
type CourseQueryApplicationServiceMock = {
  search: ReturnType<typeof vi.fn>;
};

/**
 * Creates a Course mutation-application mock.
 *
 * The returned object intentionally implements the complete
 * CourseApplicationService contract so future controller methods cannot
 * silently bypass the application boundary.
 */
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

/**
 * Creates a CourseVersion application mock.
 *
 * This helper is intentionally declared at module scope because it is shared
 * by both CourseController and CourseVersionController test suites.
 */
const createCourseVersionApplicationMock =
  (): CourseVersionApplicationService => ({
    createVersion: vi.fn(),
    publishVersion: vi.fn(),
  });

/**
 * Creates a Course query/read-side application mock.
 *
 * The query boundary is deliberately kept independent from the mutation
 * application service.
 */
const createCourseQueryApplicationMock =
  (): CourseQueryApplicationServiceMock => ({
    search: vi.fn(),
  });

/**
 * Converts the structural CourseApplicationService test double into the
 * concrete dependency expected by CourseController.
 *
 * The production controller intentionally depends on the default concrete
 * application-service implementation, while this test validates only the
 * HTTP adapter behavior.
 */
const asCourseApplicationDependency = (
  application: CourseApplicationService,
): CourseControllerConstructorArgs[0] =>
  application as unknown as CourseControllerConstructorArgs[0];

/**
 * Converts the structural CourseVersionApplicationService test double into
 * the concrete dependency expected by CourseController.
 */
const asCourseVersionApplicationDependency = (
  application: CourseVersionApplicationService,
): CourseControllerConstructorArgs[1] =>
  application as unknown as CourseControllerConstructorArgs[1];

/**
 * Converts the structural query application mock into the concrete query
 * dependency expected by CourseController.
 */
const asCourseQueryApplicationDependency = (
  application: CourseQueryApplicationServiceMock,
): CourseControllerConstructorArgs[2] =>
  application as unknown as CourseControllerConstructorArgs[2];

/**
 * Converts the structural CourseVersionApplicationService test double into
 * the dependency expected by CourseVersionController.
 */
const asCourseVersionControllerDependency = (
  application: CourseVersionApplicationService,
): CourseVersionControllerConstructorArgs[0] =>
  application as unknown as CourseVersionControllerConstructorArgs[0];

/**
 * Creates the CourseController and all of its application dependencies.
 *
 * Fresh mocks are created for every invocation unless explicitly supplied,
 * preventing state leakage between tests.
 */
const createCourseController = ({
  courseApplication = createCourseApplicationMock(),
  courseVersionApplication = createCourseVersionApplicationMock(),
  courseQueryApplication = createCourseQueryApplicationMock(),
}: {
  courseApplication?: CourseApplicationService;
  courseVersionApplication?: CourseVersionApplicationService;
  courseQueryApplication?: CourseQueryApplicationServiceMock;
} = {}) => {
  const controller = new CourseController(
    asCourseApplicationDependency(courseApplication),
    asCourseVersionApplicationDependency(courseVersionApplication),
    asCourseQueryApplicationDependency(courseQueryApplication),
  );

  return {
    controller,
    courseApplication,
    courseVersionApplication,
    courseQueryApplication,
  };
};

describe('CourseController', () => {
  describe('Course read/query boundary', () => {
  it('maps HTTP query parameters and delegates Course discovery to the query application service', async () => {
    const courseQueryApplication =
      createCourseQueryApplicationMock();

    const expected: CourseQueryResultPage = {
      items: [
        {
          id: 'course-001',
          title: 'Physics',
          description: 'Introduction to physics',
          level: 'BEGINNER',
          type: 'SELF_PACED',
          visibility: 'PRIVATE',
          status: 'DRAFT',
          instructorId: 'instructor-001',
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
          updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    vi.mocked(courseQueryApplication.search).mockResolvedValue(
      expected,
    );

    const { controller } = createCourseController({
      courseQueryApplication,
    });

    const request: CourseQueryDto = {
      page: '1',
      limit: '20',
      sortOrder: 'asc',
      sortBy: 'title',
      query: 'physics',
      status: 'DRAFT',
      visibility: 'PRIVATE',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      instructorId: 'instructor-001',
    };

    const result = await controller.query(request);

    expect(courseQueryApplication.search).toHaveBeenCalledTimes(1);

    expect(courseQueryApplication.search).toHaveBeenCalledWith({
      page: '1',
      limit: '20',
      sortOrder: 'asc',
      sortBy: 'title',
      query: 'physics',
      status: 'DRAFT',
      visibility: 'PRIVATE',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      instructorId: 'instructor-001',
    });

    expect(result).toEqual({
      items: [
        {
          id: 'course-001',
          title: 'Physics',
          description: 'Introduction to physics',
          level: 'BEGINNER',
          type: 'SELF_PACED',
          visibility: 'PRIVATE',
          status: 'DRAFT',
          instructorId: 'instructor-001',
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
          updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    expect(result).not.toBe(expected);
  });

  it('preserves HTTP pagination and sorting values for application-layer validation', async () => {
    const courseQueryApplication =
      createCourseQueryApplicationMock();

    const expected: CourseQueryResultPage = {
      items: [],
      meta: {
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    };

    vi.mocked(courseQueryApplication.search).mockResolvedValue(
      expected,
    );

    const { controller } = createCourseController({
      courseQueryApplication,
    });

    const request: CourseQueryDto = {
      page: '2',
      limit: '10',
      sortOrder: 'desc',
      sortBy: 'updatedAt',
      query: 'advanced',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      level: 'ADVANCED',
      type: 'SELF_PACED',
      instructorId: 'instructor-002',
    };

    const result = await controller.query(request);

    expect(courseQueryApplication.search).toHaveBeenCalledTimes(1);

    expect(courseQueryApplication.search).toHaveBeenCalledWith({
      page: '2',
      limit: '10',
      sortOrder: 'desc',
      sortBy: 'updatedAt',
      query: 'advanced',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      level: 'ADVANCED',
      type: 'SELF_PACED',
      instructorId: 'instructor-002',
    });

    expect(result).toEqual(expected);
  });

  it('does not apply application defaults in the HTTP controller', async () => {
    const courseQueryApplication =
      createCourseQueryApplicationMock();

    const expected: CourseQueryResultPage = {
      items: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    vi.mocked(courseQueryApplication.search).mockResolvedValue(
      expected,
    );

    const { controller } = createCourseController({
      courseQueryApplication,
    });

    const request: CourseQueryDto = {};

    const result = await controller.query(request);

    expect(courseQueryApplication.search).toHaveBeenCalledTimes(1);

    expect(courseQueryApplication.search).toHaveBeenCalledWith({});

    expect(result).toEqual(expected);
  });

  it('does not perform query validation inside the controller', async () => {
    const courseQueryApplication =
      createCourseQueryApplicationMock();

    const expected: CourseQueryResultPage = {
      items: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    vi.mocked(courseQueryApplication.search).mockResolvedValue(
      expected,
    );

    const { controller } = createCourseController({
      courseQueryApplication,
    });

    const request: CourseQueryDto = {
      page: 'not-a-number',
      limit: 'invalid',
      sortBy: 'unsupported-field',
      sortOrder: 'invalid-order',
    };

    await controller.query(request);

    expect(courseQueryApplication.search).toHaveBeenCalledTimes(1);

    expect(courseQueryApplication.search).toHaveBeenCalledWith(
      request,
    );
  });

  it('maps the application result into a separate HTTP response object', async () => {
    const courseQueryApplication =
      createCourseQueryApplicationMock();

    const expected: CourseQueryResultPage = {
      items: [
        {
          id: 'course-001',
          title: 'Physics',
          description: null,
          level: 'BEGINNER',
          type: 'SELF_PACED',
          visibility: 'PUBLIC',
          status: 'PUBLISHED',
          instructorId: 'instructor-001',
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
          updatedAt: new Date('2026-09-02T00:00:00.000Z'),
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    vi.mocked(courseQueryApplication.search).mockResolvedValue(
      expected,
    );

    const { controller } = createCourseController({
      courseQueryApplication,
    });

    const result = await controller.query({
      query: 'physics',
    });

    expect(result).toEqual(expected);
    expect(result).not.toBe(expected);
    expect(result.items).not.toBe(expected.items);
    expect(result.meta).not.toBe(expected.meta);
    expect(result.items[0]).not.toBe(expected.items[0]);
  });

  it('does not route Course queries through the mutation application service', async () => {
    const courseApplication = createCourseApplicationMock();
    const courseQueryApplication =
      createCourseQueryApplicationMock();

    const expected: CourseQueryResultPage = {
      items: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    vi.mocked(courseQueryApplication.search).mockResolvedValue(
      expected,
    );

    const { controller } = createCourseController({
      courseApplication,
      courseQueryApplication,
    });

    await controller.query({
      page: '1',
      limit: '20',
      sortOrder: 'asc',
      sortBy: 'createdAt',
      query: 'physics',
    });

    expect(courseQueryApplication.search).toHaveBeenCalledTimes(1);

    expect(courseApplication.getCourse).not.toHaveBeenCalled();

    expect(courseApplication.createCourse).not.toHaveBeenCalled();

    expect(courseApplication.updateCourse).not.toHaveBeenCalled();

    expect(courseApplication.publish).not.toHaveBeenCalled();

    expect(courseApplication.archive).not.toHaveBeenCalled();
  });
});

  describe('Course commands', () => {
    it('delegates Course creation to the application service', async () => {
      const courseApplication = createCourseApplicationMock();

      const expected = {
        id: 'course-001',
      };

      vi.mocked(courseApplication.createCourse).mockResolvedValue(
        expected as never,
      );

      const { controller } = createCourseController({
        courseApplication,
      });

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

      const expected = {
        id: 'course-001',
      };

      vi.mocked(courseApplication.getCourse).mockResolvedValue(
        expected as never,
      );

      const { controller } = createCourseController({
        courseApplication,
      });

      const params: GetCourseDto = {
        courseId: 'course-001',
      };

      const result = await controller.get(params);

      expect(courseApplication.getCourse).toHaveBeenCalledTimes(1);

      expect(courseApplication.getCourse).toHaveBeenCalledWith({
        courseId: 'course-001',
      });

      expect(result).toBe(expected);
    });

    it('maps Course metadata updates without adding transport-only fields', async () => {
      const courseApplication = createCourseApplicationMock();

      const expected = {
        id: 'course-001',
      };

      vi.mocked(courseApplication.updateCourse).mockResolvedValue(
        expected as never,
      );

      const { controller } = createCourseController({
        courseApplication,
      });

      const request: UpdateCourseMetadataDto = {
        title: 'Updated Physics',
        description: 'Updated description',
      };

      const result = await controller.update('course-001', request);

      expect(courseApplication.updateCourse).toHaveBeenCalledTimes(1);

      expect(courseApplication.updateCourse).toHaveBeenCalledWith({
        courseId: 'course-001',
        title: 'Updated Physics',
        description: 'Updated description',
      });

      expect(result).toBe(expected);
    });

    it('maps ownership assignment to the application service', async () => {
      const courseApplication = createCourseApplicationMock();

      const expected = {
        id: 'course-001',
      };

      vi.mocked(courseApplication.assignOwnership).mockResolvedValue(
        expected as never,
      );

      const { controller } = createCourseController({
        courseApplication,
      });

      const request: AssignCourseOwnershipDto = {
        principalId: 'principal-001',
        role: 'OWNER',
      };

      const result = await controller.assignOwnership('course-001', request);

      expect(courseApplication.assignOwnership).toHaveBeenCalledTimes(1);

      expect(courseApplication.assignOwnership).toHaveBeenCalledWith({
        courseId: 'course-001',
        principalId: 'principal-001',
        role: 'OWNER',
      });

      expect(result).toBe(expected);
    });

    it('maps ownership removal to the application service', async () => {
      const courseApplication = createCourseApplicationMock();

      const expected = {
        id: 'course-001',
      };

      vi.mocked(courseApplication.removeOwnership).mockResolvedValue(
        expected as never,
      );

      const { controller } = createCourseController({
        courseApplication,
      });

      const request: RemoveCourseOwnershipDto = {
        principalId: 'principal-001',
        role: 'OWNER',
      };

      const result = await controller.removeOwnership('course-001', request);

      expect(courseApplication.removeOwnership).toHaveBeenCalledTimes(1);

      expect(courseApplication.removeOwnership).toHaveBeenCalledWith({
        courseId: 'course-001',
        principalId: 'principal-001',
        role: 'OWNER',
      });

      expect(result).toBe(expected);
    });

    it('maps complete ownership replacement to the application service', async () => {
      const courseApplication = createCourseApplicationMock();

      const expected = {
        id: 'course-001',
      };

      vi.mocked(courseApplication.replaceOwnership).mockResolvedValue(
        expected as never,
      );

      const { controller } = createCourseController({
        courseApplication,
      });

      const request: ReplaceCourseOwnershipDto = {
        assignments: [
          {
            principalId: 'principal-001',
            role: 'OWNER',
          },
        ],
      };

      const result = await controller.replaceOwnership('course-001', request);

      expect(courseApplication.replaceOwnership).toHaveBeenCalledTimes(1);

      expect(courseApplication.replaceOwnership).toHaveBeenCalledWith({
        courseId: 'course-001',
        assignments: [
          {
            principalId: 'principal-001',
            role: 'OWNER',
          },
        ],
      });

      expect(result).toBe(expected);
    });

    it('maps Course lifecycle commands using only the route identifier', async () => {
      const courseApplication = createCourseApplicationMock();

      const { controller } = createCourseController({
        courseApplication,
      });

      await controller.submitForReview('course-001');
      await controller.requestChanges('course-001');
      await controller.publish('course-001');
      await controller.unpublish('course-001');
      await controller.archive('course-001');

      expect(courseApplication.submitForReview).toHaveBeenCalledTimes(1);

      expect(courseApplication.submitForReview).toHaveBeenCalledWith({
        courseId: 'course-001',
      });

      expect(courseApplication.requestChanges).toHaveBeenCalledTimes(1);

      expect(courseApplication.requestChanges).toHaveBeenCalledWith({
        courseId: 'course-001',
      });

      expect(courseApplication.publish).toHaveBeenCalledTimes(1);

      expect(courseApplication.publish).toHaveBeenCalledWith({
        courseId: 'course-001',
      });

      expect(courseApplication.unpublish).toHaveBeenCalledTimes(1);

      expect(courseApplication.unpublish).toHaveBeenCalledWith({
        courseId: 'course-001',
      });

      expect(courseApplication.archive).toHaveBeenCalledTimes(1);

      expect(courseApplication.archive).toHaveBeenCalledWith({
        courseId: 'course-001',
      });
    });

    it('maps CourseVersion creation to the version application service', async () => {
      const courseVersionApplication = createCourseVersionApplicationMock();

      const expected = {
        id: 'course-version-001',
      };

      vi.mocked(courseVersionApplication.createVersion).mockResolvedValue(
        expected as never,
      );

      const { controller } = createCourseController({
        courseVersionApplication,
      });

      const result = await controller.createVersion('course-001');

      expect(courseVersionApplication.createVersion).toHaveBeenCalledTimes(1);

      expect(courseVersionApplication.createVersion).toHaveBeenCalledWith({
        courseId: 'course-001',
      });

      expect(result).toBe(expected);
    });
  });
});

describe('CourseVersionController', () => {
  it('maps CourseVersion publication to the application service', async () => {
    const courseVersionApplication = createCourseVersionApplicationMock();

    const expected = {
      id: 'course-version-001',
    };

    vi.mocked(courseVersionApplication.publishVersion).mockResolvedValue(
      expected as never,
    );

    const controller = new CourseVersionController(
      asCourseVersionControllerDependency(courseVersionApplication),
    );

    const result = await controller.publish('course-version-001');

    expect(courseVersionApplication.publishVersion).toHaveBeenCalledTimes(1);

    expect(courseVersionApplication.publishVersion).toHaveBeenCalledWith({
      courseVersionId: 'course-version-001',
    });

    expect(result).toBe(expected);
  });
});

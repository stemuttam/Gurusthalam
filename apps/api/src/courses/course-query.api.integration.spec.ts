import type { INestApplication } from '@nestjs/common';

import { Test } from '@nestjs/testing';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  CourseDomainEventName,
  CourseProjectionEventHandler,
  DefaultCourseQueryApplicationService,
  createDomainEvent,
  type CourseDomainEvent,
  type CourseStatus,
} from '@gurusthalam/courses';

import { PrismaService } from '../database/prisma/prisma.service.js';

import {
  PrismaCourseCatalogProjectionPersistence,
  PrismaCourseSearchProjectionPersistence,
} from '../database/prisma/read-models/courses/index.js';

import { COURSE_QUERY } from '../database/prisma/repositories/courses/courses-repository.tokens.js';

import { PrismaCourseQuery } from '../database/prisma/repositories/courses/prisma-course.query.js';

import { CourseController } from './course.controller.js';

import { CoursesApplicationModule } from './courses-application.module.js';

/**
 * 4.14-K — API Read-Model Integration
 *
 * This suite exercises the real HTTP/API query boundary:
 *
 *   HTTP
 *     ↓
 *   CourseController
 *     ↓
 *   HTTP → Application mapping
 *     ↓
 *   DefaultCourseQueryApplicationService
 *     ↓
 *   Zod validation / coercion / defaults
 *     ↓
 *   CourseQuery
 *     ↓
 *   PrismaCourseQuery
 *     ↓
 *   CourseCatalogProjection
 *     ↓
 *   PostgreSQL
 *     ↓
 *   CourseQueryResultPage
 *     ↓
 *   Application → HTTP response mapping
 *     ↓
 *   JSON
 *
 * The suite deliberately uses:
 *
 * - the real Nest CoursesApplicationModule;
 * - the real PrismaService;
 * - the real PrismaCourseQuery;
 * - the real DefaultCourseQueryApplicationService;
 * - the real CourseController;
 * - the real PostgreSQL database;
 * - the real CourseProjectionEventHandler;
 * - the real projection persistence implementations.
 *
 * No Prisma mock is used.
 *
 * No CourseQuery mock is used.
 *
 * No controller mock is used.
 *
 * No production read-model rows are inserted directly merely to bypass
 * the projection boundary. Test data enters the read model through the
 * production CourseProjectionEventHandler.
 *
 * IMPORTANT TEST-ISOLATION RULE
 * -----------------------------
 *
 * This suite executes against the shared PostgreSQL integration database.
 *
 * Vitest may execute integration files concurrently. Therefore every
 * Course identity and instructor identity is process-scoped and test-scoped.
 *
 * Every HTTP query also includes the current test's instructorId.
 *
 * Cleanup is restricted to the exact Course/instructor identities created
 * by this suite.
 */
describe('Course query API — PostgreSQL integration — 4.14-K', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectionHandler: CourseProjectionEventHandler;

  /**
   * The process id prevents collisions between separate Vitest workers.
   *
   * Date.now() additionally prevents accidental identity reuse if a process
   * is restarted and its PID is later reused.
   */
  const isolationPrefix = `course-api-k-${process.pid}-${Date.now()}`;

  let testSequence = 0;
  let courseSequence = 0;

  let currentCourseIds: string[] = [];
  let currentInstructorId = '';

  const createdAt = new Date('2026-09-01T00:00:00.000Z');

  /**
   * Returns a unique Course identifier for the current test.
   */
  function createCourseId(): string {
    courseSequence += 1;

    return `${isolationPrefix}-test-${testSequence}-course-${courseSequence}`;
  }

  /**
   * Returns a unique instructor identifier for the current test.
   */
  function createInstructorId(): string {
    return `${isolationPrefix}-instructor-${testSequence}`;
  }

  /**
   * Creates a canonical CourseCreated domain event.
   *
   * The event is intentionally created with the production domain-event
   * factory rather than manually constructing an infrastructure-specific
   * projection row.
   */
  function createCreatedEvent(
    courseId: string,
    instructorId: string,
    overrides: {
      readonly title?: string;
      readonly description?: string | null;
      readonly level?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS';
      readonly type?: 'SELF_PACED' | 'LIVE' | 'BLENDED';
      readonly visibility?: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
      readonly status?:
        'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
      readonly occurredAt?: Date;
    } = {},
  ): Extract<
    CourseDomainEvent,
    {
      eventName: typeof CourseDomainEventName.CREATED;
    }
  > {
    return createDomainEvent(
      CourseDomainEventName.CREATED,
      courseId,
      {
        courseId,
        title: overrides.title ?? 'Introduction to Physics',
        description:
          overrides.description === undefined
            ? 'Mechanics and motion.'
            : overrides.description,
        level: overrides.level ?? 'BEGINNER',
        type: overrides.type ?? 'SELF_PACED',
        visibility: overrides.visibility ?? 'PUBLIC',
        status: overrides.status ?? 'DRAFT',
        instructorId,
      },
      overrides.occurredAt ?? createdAt,
    );
  }

  /**
   * Creates a strongly typed Course lifecycle event.
   */
  function createLifecycleEvent(
    courseId: string,
    eventName:
      | typeof CourseDomainEventName.PUBLISHED
      | typeof CourseDomainEventName.UNPUBLISHED
      | typeof CourseDomainEventName.ARCHIVED
      | typeof CourseDomainEventName.SUBMITTED_FOR_REVIEW
      | typeof CourseDomainEventName.CHANGES_REQUESTED,
    previousStatus: CourseStatus,
    currentStatus: CourseStatus,
    occurredAt: Date,
  ): CourseDomainEvent {
    return createDomainEvent(
      eventName,
      courseId,
      {
        courseId,
        previousStatus,
        currentStatus,
      },
      occurredAt,
    ) as CourseDomainEvent;
  }

  /**
   * Registers a Course identity as belonging to the current test.
   */
  function registerCourse(courseId: string): void {
    currentCourseIds.push(courseId);
  }

  /**
   * Removes only projection rows belonging to the current test.
   *
   * Both projections are cleaned because the production projection handler
   * maintains both read-side representations.
   */
  async function clearCurrentProjectionRows(): Promise<void> {
    if (currentCourseIds.length === 0 || !currentInstructorId) {
      return;
    }

    await prisma.courseSearchProjection.deleteMany({
      where: {
        courseId: {
          in: currentCourseIds,
        },
        instructorId: currentInstructorId,
      },
    });

    await prisma.courseCatalogProjection.deleteMany({
      where: {
        courseId: {
          in: currentCourseIds,
        },
        instructorId: currentInstructorId,
      },
    });
  }

  /**
   * Projects a CourseCreated event through the real projection boundary.
   */
  async function projectCourse(
    overrides: {
      readonly title?: string;
      readonly description?: string | null;
      readonly level?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS';
      readonly type?: 'SELF_PACED' | 'LIVE' | 'BLENDED';
      readonly visibility?: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
      readonly status?:
        'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
      readonly occurredAt?: Date;
    } = {},
  ): Promise<string> {
    const courseId = createCourseId();

    registerCourse(courseId);

    await projectionHandler.handle(
      createCreatedEvent(courseId, currentInstructorId, overrides),
    );

    return courseId;
  }

  /**
   * Sends an actual HTTP GET request to the running Nest application.
   *
   * The test suite deliberately avoids adding Supertest as a new dependency.
   * Node 22's native fetch is sufficient because the Nest application is
   * started on an ephemeral local port.
   */
  async function getCourses(
    queryParameters: Record<string, string> = {},
  ): Promise<{
    readonly status: number;
    readonly body: unknown;
  }> {
    const server = app.getHttpServer();

    const address = server.address();

    if (address === null || typeof address === 'string') {
      throw new Error(
        'Expected the Course API test server to expose a TCP address.',
      );
    }

    const query = new URLSearchParams(queryParameters).toString();

    const url =
      `http://127.0.0.1:${address.port}/courses` +
      (query.length > 0 ? `?${query}` : '');

    const response = await fetch(url);

    const body = await response.json();

    return {
      status: response.status,
      body,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CoursesApplicationModule],
    }).compile();

    /**
     * Create a real Nest HTTP application from the production
     * CoursesApplicationModule.
     *
     * This is intentionally not a standalone controller instance.
     */
    app = moduleRef.createNestApplication();

    await app.init();

    /**
     * Bind to an ephemeral port so the test never depends on a fixed
     * development or CI port.
     */
    await app.listen(0, '127.0.0.1');

    /**
     * Retrieve the actual production PrismaService from Nest DI.
     *
     * No mock or replacement is installed.
     */
    prisma = moduleRef.get(PrismaService);

    /**
     * Build the real projection boundary on top of the same PrismaService
     * instance owned by the Nest application.
     */
    const catalogPersistence = new PrismaCourseCatalogProjectionPersistence(
      prisma,
    );

    const searchPersistence = new PrismaCourseSearchProjectionPersistence(
      prisma,
    );

    projectionHandler = new CourseProjectionEventHandler({
      catalog: catalogPersistence,
      search: searchPersistence,
    });
  });

  beforeEach(async () => {
    testSequence += 1;
    courseSequence = 0;

    currentCourseIds = [];

    currentInstructorId = createInstructorId();

    await clearCurrentProjectionRows();
  });

  afterEach(async () => {
    await clearCurrentProjectionRows();

    currentCourseIds = [];
    currentInstructorId = '';
  });

  afterAll(async () => {
    await app.close();
  });

  /*
   * --------------------------------------------------------------------------
   * K1 — Real Nest composition
   * --------------------------------------------------------------------------
   */

  it('K1 — resolves the real CourseController and query application boundary', async () => {
    const controller = app.get(CourseController);

    const queryApplication = app.get(DefaultCourseQueryApplicationService);

    const courseQuery = app.get(COURSE_QUERY);

    expect(controller).toBeInstanceOf(CourseController);

    expect(queryApplication).toBeInstanceOf(
      DefaultCourseQueryApplicationService,
    );

    expect(courseQuery).toBeInstanceOf(PrismaCourseQuery);
  });

  /*
   * --------------------------------------------------------------------------
   * K2 — Real HTTP → PostgreSQL query path
   * --------------------------------------------------------------------------
   */

  it('K2 — returns a real PostgreSQL read-model row through the HTTP API', async () => {
    const courseId = await projectCourse({
      title: 'Physics Fundamentals',
      description: 'Foundations of mechanics.',
    });

    const response = await getCourses({
      instructorId: currentInstructorId,
    });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      items: [
        {
          id: courseId,
          title: 'Physics Fundamentals',
          description: 'Foundations of mechanics.',
          level: 'BEGINNER',
          type: 'SELF_PACED',
          visibility: 'PUBLIC',
          status: 'DRAFT',
          instructorId: currentInstructorId,
          createdAt: createdAt.toISOString(),
          updatedAt: createdAt.toISOString(),
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
  });

  /*
   * --------------------------------------------------------------------------
   * K3 — HTTP pagination coercion
   * --------------------------------------------------------------------------
   */

  it('K3 — coerces HTTP pagination strings through the application validation boundary', async () => {
    const firstCourseId = await projectCourse({
      title: 'Algebra',
      occurredAt: new Date('2026-09-01T00:00:01.000Z'),
    });

    const secondCourseId = await projectCourse({
      title: 'Biology',
      occurredAt: new Date('2026-09-01T00:00:02.000Z'),
    });

    const thirdCourseId = await projectCourse({
      title: 'Chemistry',
      occurredAt: new Date('2026-09-01T00:00:03.000Z'),
    });

    const response = await getCourses({
      instructorId: currentInstructorId,
      page: '2',
      limit: '1',
      sortBy: 'title',
      sortOrder: 'asc',
    });

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      items: [
        {
          id: secondCourseId,
          title: 'Biology',
        },
      ],
      meta: {
        page: 2,
        limit: 1,
        total: 3,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    });

    expect(firstCourseId).not.toBe(secondCourseId);

    expect(thirdCourseId).not.toBe(secondCourseId);
  });

  /*
   * --------------------------------------------------------------------------
   * K4 — Application defaults
   * --------------------------------------------------------------------------
   */

  it('K4 — applies application-owned pagination defaults through the HTTP boundary', async () => {
    const courseId = await projectCourse({
      title: 'Default Pagination Course',
    });

    const response = await getCourses({
      instructorId: currentInstructorId,
    });

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      items: [
        {
          id: courseId,
          title: 'Default Pagination Course',
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
  });

  /*
   * --------------------------------------------------------------------------
   * K5 — Filtering
   * --------------------------------------------------------------------------
   */

  it('K5 — applies HTTP filters through the real application and PostgreSQL query boundaries', async () => {
    const matchingCourseId = await projectCourse({
      title: 'Advanced Physics',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      level: 'ADVANCED',
      type: 'BLENDED',
    });

    await projectCourse({
      title: 'Advanced Mathematics',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      level: 'ADVANCED',
      type: 'BLENDED',
    });

    await projectCourse({
      title: 'Advanced Physics Draft',
      status: 'DRAFT',
      visibility: 'PUBLIC',
      level: 'ADVANCED',
      type: 'BLENDED',
    });

    const response = await getCourses({
      instructorId: currentInstructorId,
      query: 'physics',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      level: 'ADVANCED',
      type: 'BLENDED',
    });

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      items: [
        {
          id: matchingCourseId,
          title: 'Advanced Physics',
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          level: 'ADVANCED',
          type: 'BLENDED',
        },
      ],
      meta: {
        total: 1,
        totalPages: 1,
      },
    });
  });

  /*
   * --------------------------------------------------------------------------
   * K6 — Sorting
   * --------------------------------------------------------------------------
   */

  it('K6 — applies requested sorting and deterministic ordering through the HTTP API', async () => {
    const firstCourseId = await projectCourse({
      title: 'Zoology',
      occurredAt: new Date('2026-09-01T00:00:01.000Z'),
    });

    const secondCourseId = await projectCourse({
      title: 'Algebra',
      occurredAt: new Date('2026-09-01T00:00:02.000Z'),
    });

    const thirdCourseId = await projectCourse({
      title: 'Biology',
      occurredAt: new Date('2026-09-01T00:00:03.000Z'),
    });

    const response = await getCourses({
      instructorId: currentInstructorId,
      sortBy: 'title',
      sortOrder: 'asc',
    });

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      items: [
        {
          id: secondCourseId,
          title: 'Algebra',
        },
        {
          id: thirdCourseId,
          title: 'Biology',
        },
        {
          id: firstCourseId,
          title: 'Zoology',
        },
      ],
    });
  });

  /*
   * --------------------------------------------------------------------------
   * K7 — Search
   * --------------------------------------------------------------------------
   */

  it('K7 — searches Course titles and descriptions through the HTTP query boundary', async () => {
    const matchingByTitleId = await projectCourse({
      title: 'Quantum Physics',
      description: 'Introduction to modern physics.',
    });

    await projectCourse({
      title: 'Classical Mechanics',
      description: 'Newtonian mechanics.',
    });

    const response = await getCourses({
      instructorId: currentInstructorId,
      query: 'quantum',
    });

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      items: [
        {
          id: matchingByTitleId,
          title: 'Quantum Physics',
        },
      ],
      meta: {
        total: 1,
        totalPages: 1,
      },
    });
  });

  /*
   * --------------------------------------------------------------------------
   * K8 — Pagination metadata
   * --------------------------------------------------------------------------
   */

  it('K8 — returns complete pagination metadata from the real query result through HTTP', async () => {
    await projectCourse({
      title: 'Course A',
    });

    await projectCourse({
      title: 'Course B',
    });

    await projectCourse({
      title: 'Course C',
    });

    await projectCourse({
      title: 'Course D',
    });

    const response = await getCourses({
      instructorId: currentInstructorId,
      page: '2',
      limit: '2',
      sortBy: 'title',
      sortOrder: 'asc',
    });

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      meta: {
        page: 2,
        limit: 2,
        total: 4,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });

    expect(
      (
        response.body as {
          items: readonly unknown[];
        }
      ).items,
    ).toHaveLength(2);
  });

  /*
   * --------------------------------------------------------------------------
   * K9 — Lifecycle visibility
   * --------------------------------------------------------------------------
   */

  it('K9 — exposes lifecycle changes through the HTTP read model after projection processing', async () => {
    const courseId = await projectCourse({
      title: 'Lifecycle Physics',
      status: 'DRAFT',
    });

    const beforePublish = await getCourses({
      instructorId: currentInstructorId,
    });

    expect(beforePublish.status).toBe(200);

    expect(beforePublish.body).toMatchObject({
      items: [
        {
          id: courseId,
          status: 'DRAFT',
        },
      ],
    });

    await projectionHandler.handle(
      createLifecycleEvent(
        courseId,
        CourseDomainEventName.PUBLISHED,
        'DRAFT',
        'PUBLISHED',
        new Date('2026-09-05T00:00:00.000Z'),
      ),
    );

    const afterPublish = await getCourses({
      instructorId: currentInstructorId,
    });

    expect(afterPublish.status).toBe(200);

    expect(afterPublish.body).toMatchObject({
      items: [
        {
          id: courseId,
          status: 'PUBLISHED',
          instructorId: currentInstructorId,
        },
      ],
    });
  });

  /*
   * --------------------------------------------------------------------------
   * K10 — HTTP response mapping isolation
   * --------------------------------------------------------------------------
   */

  it('K10 — exposes only the explicit HTTP query projection and not persistence-only fields', async () => {
    const courseId = await projectCourse({
      title: 'HTTP Projection Boundary',
      description: 'Explicit response mapping.',
      level: 'INTERMEDIATE',
      type: 'LIVE',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
    });

    const response = await getCourses({
      instructorId: currentInstructorId,
    });

    expect(response.status).toBe(200);

    const body = response.body as {
      items: readonly Record<string, unknown>[];
    };

    expect(body.items).toHaveLength(1);

    const item = body.items[0];

    expect(item).toEqual({
      id: courseId,
      title: 'HTTP Projection Boundary',
      description: 'Explicit response mapping.',
      level: 'INTERMEDIATE',
      type: 'LIVE',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      instructorId: currentInstructorId,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    });

    /**
     * projectionSchemaVersion is deliberately a persistence concern and
     * must not cross the HTTP response boundary.
     */
    expect(item).not.toHaveProperty('projectionSchemaVersion');
  });
});

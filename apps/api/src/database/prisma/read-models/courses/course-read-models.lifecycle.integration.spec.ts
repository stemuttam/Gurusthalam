import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CourseDomainEventName,
  CourseProjectionEventHandler,
  createDomainEvent,
  type CourseDomainEvent,
  type CourseQueryResultPage,
  type CourseStatus,
} from '@gurusthalam/courses';

import { PrismaService } from '../../prisma.service.js';

import { PrismaCourseQuery } from '../../repositories/courses/prisma-course.query.js';

import {
  PrismaCourseCatalogProjectionPersistence,
  PrismaCourseSearchProjectionPersistence,
} from './index.js';

/**
 * 4.14-I — Consistency / Lifecycle Visibility
 *
 * This integration suite deliberately exercises the complete read-model
 * lifecycle path:
 *
 *   CourseDomainEvent
 *          ↓
 *   CourseProjectionEventHandler
 *          ↓
 *   CourseCatalogProjection
 *          ↓
 *   CourseSearchProjection
 *          ↓
 *   PostgreSQL
 *          ↓
 *   PrismaCourseQuery
 *          ↓
 *   CourseQueryResultPage
 *
 * The transactional Course aggregate is intentionally not created here.
 *
 * The purpose of this suite is to verify the read-side consistency boundary:
 *
 * - domain events are the input;
 * - projections are eventually updated;
 * - query visibility occurs after projection processing;
 * - lifecycle status transitions become query-visible;
 * - metadata changes become query-visible;
 * - stale projection events cannot regress the read model.
 *
 * This test does not replace the existing 4.14-G persistence tests or the
 * 4.14-H pagination/filter/sorting tests.
 *
 * It is an additive lifecycle-consistency regression suite.
 *
 * IMPORTANT TEST-ISOLATION RULE
 * -----------------------------
 * This suite runs against the real shared PostgreSQL database. Therefore,
 * every test receives a unique Course identity and a unique instructor
 * identity.
 *
 * The query helper scopes every read to that unique instructor. This prevents
 * unrelated projection rows created by other integration suites from entering
 * the collection result.
 *
 * Cleanup is deliberately scoped to the current test identities only.
 * No global truncation or destructive cross-suite cleanup is used.
 */
describe('Course read-model lifecycle consistency — 4.14-I', () => {
  const prisma = new PrismaService();

  const catalogPersistence = new PrismaCourseCatalogProjectionPersistence(
    prisma,
  );

  const searchPersistence = new PrismaCourseSearchProjectionPersistence(prisma);

  const persistence = {
    catalog: catalogPersistence,
    search: searchPersistence,
  };

  const projectionHandler = new CourseProjectionEventHandler(persistence);

  const query = new PrismaCourseQuery(prisma);

  /**
   * The process id prevents collisions between separate Vitest workers.
   *
   * The monotonically increasing sequence prevents collisions between tests
   * executed by the same worker.
   */
  const isolationPrefix = `course-read-model-i-${process.pid}`;

  let testSequence = 0;

  let courseId = '';
  let instructorId = '';

  const createdAt = new Date('2026-09-01T00:00:00.000Z');

  /**
   * Deletes only the deterministic projection rows belonging to the current
   * test identity.
   *
   * CourseCatalogProjection and CourseSearchProjection are intentionally
   * independent from the transactional Course table.
   *
   * Therefore this cleanup does not create, mutate, or delete a Course
   * aggregate.
   */
  async function clearProjectionRows(): Promise<void> {
    if (!courseId || !instructorId) {
      return;
    }

    await prisma.courseSearchProjection.deleteMany({
      where: {
        courseId,
        instructorId,
      },
    });

    await prisma.courseCatalogProjection.deleteMany({
      where: {
        courseId,
        instructorId,
      },
    });
  }

  /**
   * Executes the public query boundary against the real PostgreSQL
   * projection.
   *
   * The instructor filter is intentionally unique to the current test.
   * This makes the collection query deterministic even when other
   * integration suites share the same PostgreSQL database.
   *
   * The query still exercises the real PrismaCourseQuery implementation and
   * therefore remains a genuine 4.14-I read-model integration test.
   */
  async function readCourse(): Promise<CourseQueryResultPage> {
    return query.search({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'asc',
      instructorId,
    });
  }

  /**
   * Creates the canonical CourseCreated event used as the beginning of the
   * read-model lifecycle.
   */
  function createCreatedEvent(
    occurredAt: Date = createdAt,
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
        title: 'Introduction to Physics',
        description: 'Mechanics and motion.',
        level: 'BEGINNER',
        type: 'SELF_PACED',
        visibility: 'PUBLIC',
        status: 'DRAFT',
        instructorId,
      },
      occurredAt,
    );
  }

  /**
   * Creates a strongly typed Course lifecycle event.
   *
   * The domain-event factory is intentionally reused rather than manually
   * constructing event envelopes so this integration test exercises the
   * production domain-event shape.
   */
  function createLifecycleEvent(
    eventName:
      | typeof CourseDomainEventName.SUBMITTED_FOR_REVIEW
      | typeof CourseDomainEventName.CHANGES_REQUESTED
      | typeof CourseDomainEventName.PUBLISHED
      | typeof CourseDomainEventName.UNPUBLISHED
      | typeof CourseDomainEventName.ARCHIVED,
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
   * Creates a metadata update event through the production domain-event
   * factory.
   *
   * This keeps the test aligned with the existing Course domain event
   * contract rather than inventing a transport-specific representation.
   */
  function createMetadataUpdatedEvent(
    occurredAt: Date,
    overrides: {
      readonly title?: string;
      readonly description?: string | null;
      readonly level?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
      readonly type?: 'SELF_PACED' | 'INSTRUCTOR_LED' | 'BLENDED';
      readonly visibility?: 'PRIVATE' | 'PUBLIC' | 'UNLISTED';
    } = {},
  ): CourseDomainEvent {
    return createDomainEvent(
      CourseDomainEventName.METADATA_UPDATED,
      courseId,
      {
        courseId,
        title: overrides.title ?? 'Advanced Physics',
        description:
          overrides.description ?? 'Advanced mechanics and motion.',
        level: overrides.level ?? 'ADVANCED',
        type: overrides.type ?? 'BLENDED',
        visibility: overrides.visibility ?? 'PUBLIC',
      },
      occurredAt,
    ) as CourseDomainEvent;
  }

  /**
   * Give every test a unique Course and instructor identity.
   *
   * This is intentionally done before each test rather than relying on a
   * fixed Course id plus cleanup. A fixed id is unsafe when multiple
   * PostgreSQL integration suites execute against the same database.
   */
  beforeEach(() => {
    testSequence += 1;

    courseId = `${isolationPrefix}-${testSequence}`;
    instructorId = `${isolationPrefix}-instructor-${testSequence}`;
  });

  /**
   * Cleanup happens after each test so a failed assertion still leaves its
   * test-owned projection rows removed before the next test begins.
   *
   * Cleanup remains strictly scoped to the current test identities.
   */
  afterEach(async () => {
    await clearProjectionRows();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /*
   * --------------------------------------------------------------------------
   * I1 — Projection consistency expectations
   * --------------------------------------------------------------------------
   */

  it('I1 — keeps catalog, search, and query projections consistent after CourseCreated', async () => {
    await projectionHandler.handle(createCreatedEvent());

    const catalog = await catalogPersistence.findByCourseId(courseId);
    const search = await searchPersistence.findByCourseId(courseId);
    const result = await readCourse();

    expect(catalog).not.toBeNull();
    expect(search).not.toBeNull();

    expect(result.items).toHaveLength(1);

    const item = result.items[0];

    expect(item).toBeDefined();

    expect(item).toMatchObject({
      id: courseId,
      title: catalog?.title,
      description: catalog?.description,
      level: catalog?.level,
      type: catalog?.type,
      visibility: catalog?.visibility,
      status: catalog?.status,
      instructorId: catalog?.instructorId,
    });

    expect(search?.courseId).toBe(catalog?.courseId);
    expect(search?.title).toBe(catalog?.title);
    expect(search?.description).toBe(catalog?.description);
    expect(search?.level).toBe(catalog?.level);
    expect(search?.type).toBe(catalog?.type);
    expect(search?.visibility).toBe(catalog?.visibility);
    expect(search?.status).toBe(catalog?.status);
    expect(search?.instructorId).toBe(catalog?.instructorId);
    expect(search?.updatedAt).toEqual(catalog?.updatedAt);
  });

  /*
   * --------------------------------------------------------------------------
   * I2 — Eventual-consistency boundary
   * --------------------------------------------------------------------------
   */

  it('I2 — keeps a newly emitted Course invisible until the projection event is processed', async () => {
    const beforeProjection = await readCourse();

    expect(beforeProjection.items).toEqual([]);
    expect(beforeProjection.meta.total).toBe(0);

    await projectionHandler.handle(createCreatedEvent());

    const afterProjection = await readCourse();

    expect(afterProjection.items).toHaveLength(1);
    expect(afterProjection.meta.total).toBe(1);
    expect(afterProjection.items[0]?.id).toBe(courseId);
  });

  /*
   * --------------------------------------------------------------------------
   * I3 — Newly created Course visibility
   * --------------------------------------------------------------------------
   */

  it('I3 — makes a newly created Course query-visible as DRAFT', async () => {
    await projectionHandler.handle(createCreatedEvent());

    const result = await readCourse();

    expect(result.items).toHaveLength(1);

    expect(result.items[0]).toMatchObject({
      id: courseId,
      title: 'Introduction to Physics',
      description: 'Mechanics and motion.',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'DRAFT',
      instructorId,
    });
  });

  /*
   * --------------------------------------------------------------------------
   * I4 — Metadata update visibility
   * --------------------------------------------------------------------------
   */

  it('I4 — makes metadata updates query-visible without changing lifecycle status', async () => {
    await projectionHandler.handle(createCreatedEvent());

    await projectionHandler.handle(
      createMetadataUpdatedEvent(
        new Date('2026-09-02T00:00:00.000Z'),
      ),
    );

    const result = await readCourse();

    expect(result.items).toHaveLength(1);

    expect(result.items[0]).toMatchObject({
      id: courseId,
      title: 'Advanced Physics',
      description: 'Advanced mechanics and motion.',
      level: 'ADVANCED',
      type: 'BLENDED',
      visibility: 'PUBLIC',
      status: 'DRAFT',
      instructorId,
    });

    expect(result.items[0]?.createdAt).toEqual(createdAt);

    expect(result.items[0]?.updatedAt).toEqual(
      new Date('2026-09-02T00:00:00.000Z'),
    );
  });

  /*
   * --------------------------------------------------------------------------
   * I5 — Submit-for-review visibility
   * --------------------------------------------------------------------------
   */

  it('I5 — exposes IN_REVIEW after Submit-for-review projection processing', async () => {
    await projectionHandler.handle(createCreatedEvent());

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        'DRAFT',
        'IN_REVIEW',
        new Date('2026-09-03T00:00:00.000Z'),
      ),
    );

    const result = await readCourse();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe('IN_REVIEW');
  });

  /*
   * --------------------------------------------------------------------------
   * I6 — Request-changes visibility
   * --------------------------------------------------------------------------
   */

  it('I6 — exposes DRAFT after Request-changes projection processing', async () => {
    await projectionHandler.handle(createCreatedEvent());

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        'DRAFT',
        'IN_REVIEW',
        new Date('2026-09-03T00:00:00.000Z'),
      ),
    );

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.CHANGES_REQUESTED,
        'IN_REVIEW',
        'DRAFT',
        new Date('2026-09-04T00:00:00.000Z'),
      ),
    );

    const result = await readCourse();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe('DRAFT');
  });

  /*
   * --------------------------------------------------------------------------
   * I7 — Publish visibility
   * --------------------------------------------------------------------------
   */

  it('I7 — exposes PUBLISHED after publication projection processing', async () => {
    await projectionHandler.handle(createCreatedEvent());

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.PUBLISHED,
        'DRAFT',
        'PUBLISHED',
        new Date('2026-09-05T00:00:00.000Z'),
      ),
    );

    const result = await readCourse();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe('PUBLISHED');
  });

  /*
   * --------------------------------------------------------------------------
   * I8 — Unpublish visibility
   * --------------------------------------------------------------------------
   */

  it('I8 — exposes UNPUBLISHED after unpublish projection processing', async () => {
    await projectionHandler.handle(createCreatedEvent());

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.PUBLISHED,
        'DRAFT',
        'PUBLISHED',
        new Date('2026-09-05T00:00:00.000Z'),
      ),
    );

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.UNPUBLISHED,
        'PUBLISHED',
        'UNPUBLISHED',
        new Date('2026-09-06T00:00:00.000Z'),
      ),
    );

    const result = await readCourse();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe('UNPUBLISHED');
  });

  /*
   * --------------------------------------------------------------------------
   * I9 — Archive visibility
   * --------------------------------------------------------------------------
   */

  it('I9 — exposes ARCHIVED after archive projection processing', async () => {
    await projectionHandler.handle(createCreatedEvent());

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.PUBLISHED,
        'DRAFT',
        'PUBLISHED',
        new Date('2026-09-05T00:00:00.000Z'),
      ),
    );

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.UNPUBLISHED,
        'PUBLISHED',
        'UNPUBLISHED',
        new Date('2026-09-06T00:00:00.000Z'),
      ),
    );

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.ARCHIVED,
        'UNPUBLISHED',
        'ARCHIVED',
        new Date('2026-09-07T00:00:00.000Z'),
      ),
    );

    const result = await readCourse();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe('ARCHIVED');
  });

  /*
   * --------------------------------------------------------------------------
   * I10 — Visibility-state transitions
   * --------------------------------------------------------------------------
   */

  it('I10 — preserves visibility while lifecycle status transitions are projected', async () => {
    await projectionHandler.handle(createCreatedEvent());

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        'DRAFT',
        'IN_REVIEW',
        new Date('2026-09-03T00:00:00.000Z'),
      ),
    );

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.PUBLISHED,
        'IN_REVIEW',
        'PUBLISHED',
        new Date('2026-09-04T00:00:00.000Z'),
      ),
    );

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.UNPUBLISHED,
        'PUBLISHED',
        'UNPUBLISHED',
        new Date('2026-09-05T00:00:00.000Z'),
      ),
    );

    const result = await readCourse();

    expect(result.items).toHaveLength(1);

    expect(result.items[0]).toMatchObject({
      id: courseId,
      visibility: 'PUBLIC',
      status: 'UNPUBLISHED',
    });
  });

  /*
   * --------------------------------------------------------------------------
   * I11 — Stale projection behavior
   * --------------------------------------------------------------------------
   */

  it('I11 — prevents a stale lifecycle event from regressing query-visible state', async () => {
    await projectionHandler.handle(createCreatedEvent());

    const newerPublishEvent = createLifecycleEvent(
      CourseDomainEventName.PUBLISHED,
      'DRAFT',
      'PUBLISHED',
      new Date('2026-09-10T00:00:00.000Z'),
    );

    const staleSubmitEvent = createLifecycleEvent(
      CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      'DRAFT',
      'IN_REVIEW',
      new Date('2026-09-03T00:00:00.000Z'),
    );

    await projectionHandler.handle(newerPublishEvent);

    const afterNewerEvent = await readCourse();

    expect(afterNewerEvent.items[0]?.status).toBe('PUBLISHED');

    await projectionHandler.handle(staleSubmitEvent);

    const afterStaleEvent = await readCourse();

    expect(afterStaleEvent.items).toHaveLength(1);
    expect(afterStaleEvent.items[0]?.status).toBe('PUBLISHED');

    const catalog = await catalogPersistence.findByCourseId(courseId);

    expect(catalog?.status).toBe('PUBLISHED');

    expect(catalog?.updatedAt).toEqual(
      new Date('2026-09-10T00:00:00.000Z'),
    );

    const search = await searchPersistence.findByCourseId(courseId);

    expect(search?.status).toBe('PUBLISHED');

    expect(search?.updatedAt).toEqual(
      new Date('2026-09-10T00:00:00.000Z'),
    );
  });

  /*
   * --------------------------------------------------------------------------
   * I12 — Full lifecycle/read-model consistency regression
   * --------------------------------------------------------------------------
   */

  it('I12 — keeps the query projection consistent across the complete lifecycle', async () => {
    await projectionHandler.handle(createCreatedEvent());

    let result = await readCourse();

    expect(result.items[0]?.status).toBe('DRAFT');

    await projectionHandler.handle(
      createMetadataUpdatedEvent(
        new Date('2026-09-02T00:00:00.000Z'),
        {
          title: 'Advanced Physics',
          description: 'Advanced mechanics and motion.',
          level: 'ADVANCED',
          type: 'BLENDED',
          visibility: 'PUBLIC',
        },
      ),
    );

    result = await readCourse();

    expect(result.items[0]).toMatchObject({
      title: 'Advanced Physics',
      description: 'Advanced mechanics and motion.',
      level: 'ADVANCED',
      type: 'BLENDED',
      visibility: 'PUBLIC',
      status: 'DRAFT',
    });

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        'DRAFT',
        'IN_REVIEW',
        new Date('2026-09-03T00:00:00.000Z'),
      ),
    );

    result = await readCourse();

    expect(result.items[0]?.status).toBe('IN_REVIEW');

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.CHANGES_REQUESTED,
        'IN_REVIEW',
        'DRAFT',
        new Date('2026-09-04T00:00:00.000Z'),
      ),
    );

    result = await readCourse();

    expect(result.items[0]?.status).toBe('DRAFT');

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.PUBLISHED,
        'DRAFT',
        'PUBLISHED',
        new Date('2026-09-05T00:00:00.000Z'),
      ),
    );

    result = await readCourse();

    expect(result.items[0]?.status).toBe('PUBLISHED');

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.UNPUBLISHED,
        'PUBLISHED',
        'UNPUBLISHED',
        new Date('2026-09-06T00:00:00.000Z'),
      ),
    );

    result = await readCourse();

    expect(result.items[0]?.status).toBe('UNPUBLISHED');

    await projectionHandler.handle(
      createLifecycleEvent(
        CourseDomainEventName.ARCHIVED,
        'UNPUBLISHED',
        'ARCHIVED',
        new Date('2026-09-07T00:00:00.000Z'),
      ),
    );

    result = await readCourse();

    expect(result.items).toHaveLength(1);

    expect(result.items[0]).toMatchObject({
      id: courseId,
      title: 'Advanced Physics',
      description: 'Advanced mechanics and motion.',
      level: 'ADVANCED',
      type: 'BLENDED',
      visibility: 'PUBLIC',
      status: 'ARCHIVED',
      instructorId,
    });

    expect(result.items[0]?.createdAt).toEqual(createdAt);

    expect(result.items[0]?.updatedAt).toEqual(
      new Date('2026-09-07T00:00:00.000Z'),
    );
  });
});
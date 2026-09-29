import { describe, expect, it, vi } from 'vitest';

import {
  CourseDomainEventName,
  createCourseMetadataUpdatedEvent,
  type CourseDomainEvent,
} from '../../domain/events/course.events.js';

import { createDomainEvent } from '../../domain/events/domain-event.js';

import type { CourseStatus } from '../../domain/enums/course-status.js';

import {
  createCourseCatalogProjection,
  type CourseCatalogProjection,
} from './course-catalog.projection.js';

import type {
  CourseCatalogProjectionPersistence,
  CourseProjectionPersistence,
  CourseSearchProjectionPersistence,
} from './course-projection.persistence.js';

import {
  CourseProjectionEventHandler,
  CourseProjectionSourceMissingError,
} from './course-projection.event-handler.js';

/**
 * Course lifecycle event names that carry CourseStatusChangedPayload.
 *
 * All currently supported Course lifecycle events use the canonical
 * CourseStatusChangedPayload contract:
 *
 * {
 *   courseId,
 *   previousStatus,
 *   currentStatus
 * }
 *
 * Keeping this union explicit prevents accidental widening of lifecycle
 * event names and keeps the test aligned with the domain-event boundary.
 */
type CourseLifecycleEventName =
  | typeof CourseDomainEventName.SUBMITTED_FOR_REVIEW
  | typeof CourseDomainEventName.CHANGES_REQUESTED
  | typeof CourseDomainEventName.PUBLISHED
  | typeof CourseDomainEventName.UNPUBLISHED
  | typeof CourseDomainEventName.ARCHIVED;

/**
 * Strongly typed test context.
 *
 * The production handler receives only the infrastructure-neutral
 * CourseProjectionPersistence contract.
 *
 * The test additionally retains the concrete Vitest mocks so assertions can
 * inspect calls without weakening the production boundary.
 */
interface CourseProjectionPersistenceTestContext {
  readonly persistence: CourseProjectionPersistence;

  readonly catalog: CourseCatalogProjectionPersistence;
  readonly search: CourseSearchProjectionPersistence;

  readonly catalogUpsert: ReturnType<
    typeof vi.fn<CourseCatalogProjectionPersistence['upsert']>
  >;

  readonly catalogFindByCourseId: ReturnType<
    typeof vi.fn<CourseCatalogProjectionPersistence['findByCourseId']>
  >;

  readonly catalogRemoveByCourseId: ReturnType<
    typeof vi.fn<CourseCatalogProjectionPersistence['removeByCourseId']>
  >;

  readonly searchUpsert: ReturnType<
    typeof vi.fn<CourseSearchProjectionPersistence['upsert']>
  >;

  readonly searchFindByCourseId: ReturnType<
    typeof vi.fn<CourseSearchProjectionPersistence['findByCourseId']>
  >;

  readonly searchRemoveByCourseId: ReturnType<
    typeof vi.fn<CourseSearchProjectionPersistence['removeByCourseId']>
  >;
}

/**
 * Creates strongly typed persistence mocks for the complete Course
 * projection persistence boundary.
 *
 * IMPORTANT:
 *
 * CourseProjectionWriteResult is boolean.
 *
 * Therefore:
 *
 *   true  = projection accepted/persisted
 *   false = projection rejected as stale
 *
 * The default successful path MUST resolve to true.
 *
 * Returning undefined here is incorrect and causes:
 *
 *   Argument of type 'undefined' is not assignable to parameter
 *   of type 'boolean'
 *
 * Individual tests can override the result with:
 *
 *   catalogUpsert.mockResolvedValue(false)
 *
 * or:
 *
 *   catalogUpsert.mockRejectedValue(...)
 *
 * when testing stale-write rejection or persistence failures.
 */
function createPersistence(): CourseProjectionPersistenceTestContext {
  const catalogUpsert = vi
    .fn<CourseCatalogProjectionPersistence['upsert']>()
    .mockResolvedValue(true);

  const catalogFindByCourseId =
    vi.fn<CourseCatalogProjectionPersistence['findByCourseId']>();

  const catalogRemoveByCourseId =
    vi.fn<CourseCatalogProjectionPersistence['removeByCourseId']>();

  const catalog: CourseCatalogProjectionPersistence = {
    upsert: catalogUpsert,
    findByCourseId: catalogFindByCourseId,
    removeByCourseId: catalogRemoveByCourseId,
  };

  const searchUpsert = vi
    .fn<CourseSearchProjectionPersistence['upsert']>()
    .mockResolvedValue(true);

  const searchFindByCourseId =
    vi.fn<CourseSearchProjectionPersistence['findByCourseId']>();

  const searchRemoveByCourseId =
    vi.fn<CourseSearchProjectionPersistence['removeByCourseId']>();

  const search: CourseSearchProjectionPersistence = {
    upsert: searchUpsert,
    findByCourseId: searchFindByCourseId,
    removeByCourseId: searchRemoveByCourseId,
  };

  const persistence: CourseProjectionPersistence = {
    catalog,
    search,
  };

  return {
    persistence,
    catalog,
    search,
    catalogUpsert,
    catalogFindByCourseId,
    catalogRemoveByCourseId,
    searchUpsert,
    searchFindByCourseId,
    searchRemoveByCourseId,
  };
}

/**
 * Safely retrieves the first argument from a strongly typed Vitest mock.
 *
 * This helper deliberately receives the actual mock function rather than
 * a production interface method so Vitest mock metadata remains available.
 */
function getFirstMockArgument<TArgs extends readonly unknown[]>(mock: {
  readonly mock: {
    readonly calls: readonly TArgs[];
  };
}): TArgs[0] {
  const firstCall = mock.mock.calls[0];

  if (firstCall === undefined) {
    throw new Error(
      'Expected the mock to have at least one call before reading its arguments.',
    );
  }

  return firstCall[0];
}

/**
 * Creates the canonical CourseCreated domain event used by the projection
 * integration tests.
 *
 * The event is created through the real domain-event factory so the test
 * exercises the actual Course domain-event envelope.
 */
function createCreatedEvent(): Extract<
  CourseDomainEvent,
  {
    eventName: typeof CourseDomainEventName.CREATED;
  }
> {
  return createDomainEvent(
    CourseDomainEventName.CREATED,
    'course-001',
    {
      courseId: 'course-001',
      title: 'Introduction to Physics',
      description: 'Mechanics and motion.',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'DRAFT',
      instructorId: 'instructor-001',
    },
    new Date('2026-01-01T00:00:00.000Z'),
  );
}

/**
 * Creates the canonical existing catalog projection used by incremental
 * metadata and lifecycle event tests.
 */
function createExistingCatalog(): CourseCatalogProjection {
  return createCourseCatalogProjection({
    courseId: 'course-001',
    title: 'Introduction to Physics',
    description: 'Mechanics and motion.',
    level: 'BEGINNER',
    type: 'SELF_PACED',
    visibility: 'PUBLIC',
    status: 'DRAFT',
    instructorId: 'instructor-001',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

/**
 * Creates a strongly typed Course lifecycle domain event.
 *
 * The generic createDomainEvent factory cannot preserve the correlation
 * between a union of lifecycle event names and the corresponding
 * CourseDomainEvent discriminated union.
 *
 * The assertion is therefore intentionally localized to this helper.
 *
 * The input parameters remain strongly typed through:
 *
 * - CourseLifecycleEventName
 * - CourseStatus
 */
function createLifecycleEvent(
  eventName: CourseLifecycleEventName,
  previousStatus: CourseStatus,
  currentStatus: CourseStatus,
  occurredAt: Date,
): CourseDomainEvent {
  return createDomainEvent(
    eventName,
    'course-001',
    {
      courseId: 'course-001',
      previousStatus,
      currentStatus,
    },
    occurredAt,
  ) as CourseDomainEvent;
}

describe('CourseProjectionEventHandler', () => {
  it('creates both catalog and search projections from CourseCreated', async () => {
    const { persistence, catalogUpsert, searchUpsert } = createPersistence();

    const handler = new CourseProjectionEventHandler(persistence);

    const event = createCreatedEvent();

    await handler.handle(event);

    expect(catalogUpsert).toHaveBeenCalledTimes(1);
    expect(searchUpsert).toHaveBeenCalledTimes(1);

    const catalogProjection = getFirstMockArgument(catalogUpsert);
    const searchProjection = getFirstMockArgument(searchUpsert);

    expect(catalogProjection).toEqual({
      courseId: 'course-001',
      title: 'Introduction to Physics',
      description: 'Mechanics and motion.',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'DRAFT',
      instructorId: 'instructor-001',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      projectionSchemaVersion: 1,
    });

    expect(searchProjection.searchText).toBe(
      'Introduction to Physics Mechanics and motion.',
    );

    expect(searchProjection.courseId).toBe(catalogProjection.courseId);
    expect(searchProjection.status).toBe(catalogProjection.status);
    expect(searchProjection.updatedAt).toEqual(catalogProjection.updatedAt);
  });

  it('applies CourseMetadataUpdated to the existing canonical projection', async () => {
    const { persistence, catalogFindByCourseId, catalogUpsert, searchUpsert } =
      createPersistence();

    const existing = createExistingCatalog();

    catalogFindByCourseId.mockResolvedValue(existing);

    const handler = new CourseProjectionEventHandler(persistence);

    const event = createCourseMetadataUpdatedEvent(
      'course-001',
      {
        courseId: 'course-001',
        title: 'Advanced Physics',
        description: 'Advanced mechanics and motion.',
        level: 'ADVANCED',
        type: 'BLENDED',
        visibility: 'PUBLIC',
      },
      new Date('2026-01-02T00:00:00.000Z'),
    );

    await handler.handle(event);

    expect(catalogFindByCourseId).toHaveBeenCalledWith('course-001');

    expect(catalogUpsert).toHaveBeenCalledTimes(1);
    expect(searchUpsert).toHaveBeenCalledTimes(1);

    const projection = getFirstMockArgument(catalogUpsert);

    expect(projection.courseId).toBe('course-001');
    expect(projection.title).toBe('Advanced Physics');
    expect(projection.description).toBe('Advanced mechanics and motion.');
    expect(projection.level).toBe('ADVANCED');
    expect(projection.type).toBe('BLENDED');
    expect(projection.visibility).toBe('PUBLIC');

    /*
     * Metadata updates must preserve lifecycle state and the original
     * creation timestamp from the canonical catalog projection.
     */
    expect(projection.status).toBe('DRAFT');

    expect(projection.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));

    expect(projection.updatedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));

    expect(projection.projectionSchemaVersion).toBe(1);

    const searchProjection = getFirstMockArgument(searchUpsert);

    expect(searchProjection.searchText).toBe(
      'Advanced Physics Advanced mechanics and motion.',
    );

    expect(searchProjection.courseId).toBe(projection.courseId);
    expect(searchProjection.status).toBe(projection.status);
  });

  it('applies lifecycle events without rebuilding unrelated Course fields', async () => {
    const { persistence, catalogFindByCourseId, catalogUpsert, searchUpsert } =
      createPersistence();

    const existing = createExistingCatalog();

    catalogFindByCourseId.mockResolvedValue(existing);

    const handler = new CourseProjectionEventHandler(persistence);

    const event = createLifecycleEvent(
      CourseDomainEventName.PUBLISHED,
      'DRAFT',
      'PUBLISHED',
      new Date('2026-01-03T00:00:00.000Z'),
    );

    await handler.handle(event);

    expect(catalogFindByCourseId).toHaveBeenCalledWith('course-001');

    expect(catalogUpsert).toHaveBeenCalledTimes(1);
    expect(searchUpsert).toHaveBeenCalledTimes(1);

    const projection = getFirstMockArgument(catalogUpsert);

    /*
     * Lifecycle events must mutate only lifecycle state.
     */
    expect(projection.courseId).toBe(existing.courseId);
    expect(projection.title).toBe(existing.title);
    expect(projection.description).toBe(existing.description);
    expect(projection.level).toBe(existing.level);
    expect(projection.type).toBe(existing.type);
    expect(projection.visibility).toBe(existing.visibility);
    expect(projection.instructorId).toBe(existing.instructorId);

    expect(projection.status).toBe('PUBLISHED');

    expect(projection.createdAt).toEqual(existing.createdAt);

    expect(projection.updatedAt).toEqual(new Date('2026-01-03T00:00:00.000Z'));

    expect(projection.projectionSchemaVersion).toBe(
      existing.projectionSchemaVersion,
    );

    const searchProjection = getFirstMockArgument(searchUpsert);

    expect(searchProjection.status).toBe('PUBLISHED');
    expect(searchProjection.courseId).toBe(projection.courseId);
    expect(searchProjection.updatedAt).toEqual(projection.updatedAt);
  });

  it('supports every Course lifecycle event through the common status boundary', async () => {
    const lifecycleEvents = [
      {
        eventName: CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        previousStatus: 'DRAFT',
        currentStatus: 'IN_REVIEW',
      },
      {
        eventName: CourseDomainEventName.CHANGES_REQUESTED,
        previousStatus: 'IN_REVIEW',
        currentStatus: 'DRAFT',
      },
      {
        eventName: CourseDomainEventName.PUBLISHED,
        previousStatus: 'DRAFT',
        currentStatus: 'PUBLISHED',
      },
      {
        eventName: CourseDomainEventName.UNPUBLISHED,
        previousStatus: 'PUBLISHED',
        currentStatus: 'UNPUBLISHED',
      },
      {
        eventName: CourseDomainEventName.ARCHIVED,
        previousStatus: 'UNPUBLISHED',
        currentStatus: 'ARCHIVED',
      },
    ] as const satisfies ReadonlyArray<{
      eventName: CourseLifecycleEventName;
      previousStatus: CourseStatus;
      currentStatus: CourseStatus;
    }>;

    for (const lifecycleEvent of lifecycleEvents) {
      const {
        persistence,
        catalogFindByCourseId,
        catalogUpsert,
        searchUpsert,
      } = createPersistence();

      const existing = createExistingCatalog();

      catalogFindByCourseId.mockResolvedValue(existing);

      const handler = new CourseProjectionEventHandler(persistence);

      const event = createLifecycleEvent(
        lifecycleEvent.eventName,
        lifecycleEvent.previousStatus,
        lifecycleEvent.currentStatus,
        new Date('2026-01-04T00:00:00.000Z'),
      );

      await handler.handle(event);

      expect(catalogFindByCourseId).toHaveBeenCalledWith('course-001');

      expect(catalogUpsert).toHaveBeenCalledTimes(1);
      expect(searchUpsert).toHaveBeenCalledTimes(1);

      const catalogProjection = getFirstMockArgument(catalogUpsert);
      const searchProjection = getFirstMockArgument(searchUpsert);

      expect(catalogProjection.status).toBe(lifecycleEvent.currentStatus);

      expect(searchProjection.status).toBe(lifecycleEvent.currentStatus);

      expect(catalogProjection.updatedAt).toEqual(
        new Date('2026-01-04T00:00:00.000Z'),
      );

      expect(searchProjection.updatedAt).toEqual(
        new Date('2026-01-04T00:00:00.000Z'),
      );
    }
  });

  it('rejects incremental events when the canonical catalog projection is missing', async () => {
    const { persistence, catalogFindByCourseId, catalogUpsert, searchUpsert } =
      createPersistence();

    catalogFindByCourseId.mockResolvedValue(null);

    const handler = new CourseProjectionEventHandler(persistence);

    const event = createCourseMetadataUpdatedEvent(
      'course-missing',
      {
        courseId: 'course-missing',
        title: 'Physics',
        description: null,
        level: 'BEGINNER',
        type: 'SELF_PACED',
        visibility: 'PUBLIC',
      },
      new Date('2026-01-05T00:00:00.000Z'),
    );

    await expect(handler.handle(event)).rejects.toBeInstanceOf(
      CourseProjectionSourceMissingError,
    );

    expect(catalogUpsert).not.toHaveBeenCalled();
    expect(searchUpsert).not.toHaveBeenCalled();
  });

  it('does not write the search projection when catalog persistence fails', async () => {
    const { persistence, catalogUpsert, searchUpsert } = createPersistence();

    catalogUpsert.mockRejectedValue(new Error('catalog persistence failed'));

    const handler = new CourseProjectionEventHandler(persistence);

    await expect(handler.handle(createCreatedEvent())).rejects.toThrow(
      'catalog persistence failed',
    );

    expect(catalogUpsert).toHaveBeenCalledTimes(1);
    expect(searchUpsert).not.toHaveBeenCalled();
  });

  it('does not expose persistence infrastructure through the event integration boundary', async () => {
    const { persistence, catalogUpsert, searchUpsert } = createPersistence();

    const handler = new CourseProjectionEventHandler(persistence);

    await handler.handle(createCreatedEvent());

    const catalogProjection = getFirstMockArgument(catalogUpsert);
    const searchProjection = getFirstMockArgument(searchUpsert);

    /*
     * The handler must pass domain/application projections to persistence,
     * never infrastructure-specific objects.
     */
    expect(catalogProjection).not.toHaveProperty('prisma');
    expect(searchProjection).not.toHaveProperty('prisma');

    expect(catalogProjection).not.toHaveProperty('embedding');
    expect(searchProjection).not.toHaveProperty('embedding');

    expect(catalogProjection).not.toHaveProperty('vectorId');
    expect(searchProjection).not.toHaveProperty('vectorId');

    expect(catalogProjection).not.toHaveProperty('agentState');
    expect(searchProjection).not.toHaveProperty('agentState');

    expect(catalogProjection).not.toHaveProperty('database');
    expect(searchProjection).not.toHaveProperty('database');
  });
});

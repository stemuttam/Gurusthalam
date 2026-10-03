import { randomUUID } from 'node:crypto';

import {
  CourseDomainEventName,
  CourseLevel,
  CourseStatus,
  CourseType,
  CourseVisibility,
  DefaultCourseApplicationService,
  DefaultCourseQueryApplicationService,
  CourseProjectionEventHandler,
  type CourseDomainEvent,
} from '@gurusthalam/courses';

import { createPrismaClient, type PrismaClient } from '@gurusthalam/database';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaCourseCatalogProjectionPersistence } from '../database/prisma/read-models/courses/prisma-course-catalog-projection.persistence.js';

import { PrismaCourseSearchProjectionPersistence } from '../database/prisma/read-models/courses/prisma-course-search-projection.persistence.js';

import { PrismaCourseRepository } from '../database/prisma/repositories/courses/prisma-course.repository.js';

import { PrismaCourseQuery } from '../database/prisma/repositories/courses/prisma-course.query.js';

describe('Course production integration chain - PostgreSQL', () => {
  let prisma: PrismaClient;

  let repository: PrismaCourseRepository;

  let courseApplicationService: DefaultCourseApplicationService;

  let queryApplicationService: DefaultCourseQueryApplicationService;

  let projectionHandler: CourseProjectionEventHandler;

  const testPrefix = `phase-4-17-b-${Date.now()}-${randomUUID()}`;

  const createdCourseIds = new Set<string>();

  beforeAll(async () => {
    prisma = createPrismaClient();

    await prisma.$connect();

    repository = new PrismaCourseRepository(prisma);

    courseApplicationService = new DefaultCourseApplicationService(repository);

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

    const courseQuery = new PrismaCourseQuery(prisma);

    queryApplicationService = new DefaultCourseQueryApplicationService(
      courseQuery,
    );
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    const courseIds = [...createdCourseIds];

    if (courseIds.length > 0) {
      await prisma.courseSearchProjection.deleteMany({
        where: {
          courseId: {
            in: courseIds,
          },
        },
      });

      await prisma.courseCatalogProjection.deleteMany({
        where: {
          courseId: {
            in: courseIds,
          },
        },
      });

      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateType: 'Course',
          aggregateId: {
            in: courseIds,
          },
        },
      });

      await prisma.courseOwnershipAssignment.deleteMany({
        where: {
          courseId: {
            in: courseIds,
          },
        },
      });

      await prisma.course.deleteMany({
        where: {
          id: {
            in: courseIds,
          },
        },
      });
    }

    await prisma.$disconnect();
  });

  const createCourseInput = () => ({
    title: `${testPrefix} Course`,
    description: `${testPrefix} description`,
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PUBLIC,
    instructorId: `${testPrefix}-instructor`,
  });

  /**
   * The Outbox stores the domain-event envelope as PostgreSQL JSON.
   *
   * CourseDomainEvent is a discriminated union. Reconstructing the
   * object field-by-field using independent unions for eventName and
   * payload causes TypeScript to lose the correlation between those
   * discriminants.
   *
   * This helper intentionally establishes the persistence boundary:
   * the integration test has already retrieved the serialized domain
   * event from the real PostgreSQL Outbox and now hands that persisted
   * event to the real projection handler.
   *
   * Production runtime validation is intentionally not duplicated here;
   * the integration test exercises the real persistence and projection
   * contracts.
   */
  const deserializeCourseDomainEvent = (value: unknown): CourseDomainEvent =>
    value as CourseDomainEvent;

  const getCourseEvents = async (
    courseId: string,
  ): Promise<readonly CourseDomainEvent[]> => {
    const rows = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'Course',
        aggregateId: courseId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return rows.map((row) => deserializeCourseDomainEvent(row.payload));
  };

  const projectEvent = async (
    event: CourseDomainEvent | undefined,
  ): Promise<CourseDomainEvent> => {
    expect(event).toBeDefined();

    if (event === undefined) {
      throw new Error('Expected a Course domain event.');
    }

    await projectionHandler.handle(event);

    return event;
  };

  it('persists Course state and its domain event atomically into PostgreSQL Outbox', async () => {
    const course =
      await courseApplicationService.createCourse(createCourseInput());

    createdCourseIds.add(course.id.toString());

    expect(course.id.toString()).toMatch(/^[0-9a-f-]{36}$/);

    /*
     * A successful repository transaction drains the aggregate event
     * collection only after Course + Outbox have committed.
     */
    expect(course.getDomainEvents()).toHaveLength(0);

    const persistedCourse = await prisma.course.findUnique({
      where: {
        id: course.id.toString(),
      },
    });

    expect(persistedCourse).not.toBeNull();

    expect(persistedCourse?.id).toBe(course.id.toString());

    expect(persistedCourse?.title).toBe(course.title);

    expect(persistedCourse?.description).toBe(course.description);

    expect(persistedCourse?.level).toBe(course.level);

    expect(persistedCourse?.type).toBe(course.type);

    expect(persistedCourse?.visibility).toBe(course.visibility);

    expect(persistedCourse?.status).toBe(CourseStatus.DRAFT);

    const outboxEvents = await getCourseEvents(course.id.toString());

    expect(outboxEvents).toHaveLength(1);

    expect(outboxEvents[0]?.eventName).toBe(CourseDomainEventName.CREATED);

    expect(outboxEvents[0]?.aggregateId).toBe(course.id.toString());

    expect(outboxEvents[0]?.payload).toMatchObject({
      courseId: course.id.toString(),
      title: course.title,
      description: course.description,
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PUBLIC,
      status: CourseStatus.DRAFT,
      instructorId: course.instructorId,
    });

    const outboxRow = await prisma.outboxEvent.findFirst({
      where: {
        aggregateType: 'Course',
        aggregateId: course.id.toString(),
        eventType: CourseDomainEventName.CREATED,
      },
    });

    expect(outboxRow).not.toBeNull();

    expect(outboxRow?.status).toBe('PENDING');

    expect(outboxRow?.attempts).toBe(0);
  });

  it('propagates a real persisted CourseCreated event into PostgreSQL read models and query results', async () => {
    const course =
      await courseApplicationService.createCourse(createCourseInput());

    createdCourseIds.add(course.id.toString());

    const events = await getCourseEvents(course.id.toString());

    expect(events).toHaveLength(1);

    const createdEvent = await projectEvent(events[0]);

    const catalogProjection = await prisma.courseCatalogProjection.findUnique({
      where: {
        courseId: course.id.toString(),
      },
    });

    expect(catalogProjection).not.toBeNull();

    expect(catalogProjection?.courseId).toBe(course.id.toString());

    expect(catalogProjection?.title).toBe(course.title);

    expect(catalogProjection?.description).toBe(course.description);

    expect(catalogProjection?.level).toBe(course.level);

    expect(catalogProjection?.type).toBe(course.type);

    expect(catalogProjection?.visibility).toBe(course.visibility);

    expect(catalogProjection?.status).toBe(CourseStatus.DRAFT);

    expect(catalogProjection?.instructorId).toBe(course.instructorId);

    const searchProjection = await prisma.courseSearchProjection.findUnique({
      where: {
        courseId: course.id.toString(),
      },
    });

    expect(searchProjection).not.toBeNull();

    expect(searchProjection?.courseId).toBe(course.id.toString());

    expect(searchProjection?.title).toBe(course.title);

    expect(searchProjection?.status).toBe(CourseStatus.DRAFT);

    expect(searchProjection?.searchText).toContain(course.title);

    expect(createdEvent.aggregateId).toBe(course.id.toString());

    const queryResult = await queryApplicationService.search({
      page: 1,
      limit: 20,
      query: course.title,
      instructorId: course.instructorId,
    });

    expect(queryResult.items).toHaveLength(1);

    expect(queryResult.items[0]).toMatchObject({
      id: course.id.toString(),
      title: course.title,
      description: course.description,
      level: course.level,
      type: course.type,
      visibility: course.visibility,
      status: CourseStatus.DRAFT,
      instructorId: course.instructorId,
    });

    expect(queryResult.meta.total).toBe(1);
  });

  it('propagates a real metadata-update event through Outbox, projection persistence, and query results', async () => {
    const course =
      await courseApplicationService.createCourse(createCourseInput());

    createdCourseIds.add(course.id.toString());

    const initialEvents = await getCourseEvents(course.id.toString());

    expect(initialEvents).toHaveLength(1);

    await projectEvent(initialEvents[0]);

    const updatedTitle = `${testPrefix} Updated Course`;

    const updatedDescription = `${testPrefix} updated description`;

    const updatedCourse = await courseApplicationService.updateMetadata({
      courseId: course.id.toString(),
      title: updatedTitle,
      description: updatedDescription,
    });

    expect(updatedCourse).not.toBeNull();

    if (updatedCourse === null) {
      throw new Error('Expected the Course update to return the Course.');
    }

    expect(updatedCourse.id.toString()).toBe(course.id.toString());

    expect(updatedCourse.title).toBe(updatedTitle);

    expect(updatedCourse.description).toBe(updatedDescription);

    const events = await getCourseEvents(course.id.toString());

    expect(events).toHaveLength(2);

    const metadataEvent = events.find(
      (event) => event.eventName === CourseDomainEventName.METADATA_UPDATED,
    );

    expect(metadataEvent).toBeDefined();

    await projectEvent(metadataEvent);

    const catalogProjection = await prisma.courseCatalogProjection.findUnique({
      where: {
        courseId: course.id.toString(),
      },
    });

    expect(catalogProjection).not.toBeNull();

    expect(catalogProjection?.title).toBe(updatedTitle);

    expect(catalogProjection?.description).toBe(updatedDescription);

    const searchProjection = await prisma.courseSearchProjection.findUnique({
      where: {
        courseId: course.id.toString(),
      },
    });

    expect(searchProjection).not.toBeNull();

    expect(searchProjection?.title).toBe(updatedTitle);

    expect(searchProjection?.description).toBe(updatedDescription);

    const queryResult = await queryApplicationService.search({
      page: 1,
      limit: 20,
      query: updatedTitle,
      instructorId: course.instructorId,
    });

    expect(queryResult.items).toHaveLength(1);

    expect(queryResult.items[0]?.id).toBe(course.id.toString());

    expect(queryResult.items[0]?.title).toBe(updatedTitle);

    expect(queryResult.items[0]?.description).toBe(updatedDescription);

    expect(queryResult.meta.total).toBe(1);
  });

  it('propagates a real lifecycle event into the read model without rehydrating the aggregate during querying', async () => {
    const course =
      await courseApplicationService.createCourse(createCourseInput());

    createdCourseIds.add(course.id.toString());

    const creationEvents = await getCourseEvents(course.id.toString());

    expect(creationEvents).toHaveLength(1);

    await projectEvent(creationEvents[0]);

    const submittedCourse = await courseApplicationService.submitForReview({
      courseId: course.id.toString(),
    });

    expect(submittedCourse.status).toBe(CourseStatus.IN_REVIEW);

    const events = await getCourseEvents(course.id.toString());

    expect(events).toHaveLength(2);

    const lifecycleEvent = events.find(
      (event) => event.eventName === CourseDomainEventName.SUBMITTED_FOR_REVIEW,
    );

    expect(lifecycleEvent).toBeDefined();

    await projectEvent(lifecycleEvent);

    const catalogProjection = await prisma.courseCatalogProjection.findUnique({
      where: {
        courseId: course.id.toString(),
      },
    });

    expect(catalogProjection?.status).toBe(CourseStatus.IN_REVIEW);

    const queryResult = await queryApplicationService.search({
      page: 1,
      limit: 20,
      status: CourseStatus.IN_REVIEW,
      instructorId: course.instructorId,
    });

    expect(queryResult.items).toHaveLength(1);

    expect(queryResult.items[0]?.id).toBe(course.id.toString());

    expect(queryResult.items[0]?.status).toBe(CourseStatus.IN_REVIEW);

    /*
     * Querying must return a read projection, not the transactional
     * Course aggregate.
     */
    expect(queryResult.items[0]).not.toBe(course);
  });
});

import {
  CourseDomainEventName,
  type CourseDomainEvent,
} from '../../domain/events/course.events.js';

import {
  createCourseCatalogProjection,
  type CourseCatalogProjection,
} from './course-catalog.projection.js';

import { createCourseSearchProjection } from './course-search.projection.js';

import type { CourseProjectionPersistence } from './course-projection.persistence.js';

/**
 * Error raised when a non-creation Course domain event arrives before
 * the corresponding CourseCatalog projection exists.
 */
export class CourseProjectionSourceMissingError extends Error {
  constructor(courseId: string, eventName: string) {
    super(
      `CourseCatalog projection for Course "${courseId}" does not exist while processing "${eventName}".`,
    );

    this.name = 'CourseProjectionSourceMissingError';
  }
}

/**
 * Infrastructure-neutral Course domain-event -> read-model integration.
 *
 * Architectural responsibility:
 *
 *   CourseDomainEvent
 *          ↓
 *   CourseCatalogProjection
 *          ↓
 *   CourseSearchProjection
 *          ↓
 *   ProjectionPersistence
 *
 * 4.14-G additionally establishes:
 *
 * - replay safety;
 * - stale-event rejection;
 * - concurrent duplicate-delivery safety;
 * - deterministic catalog -> search propagation.
 *
 * The transactional Course remains the source of truth.
 */
export class CourseProjectionEventHandler {
  constructor(private readonly persistence: CourseProjectionPersistence) {}

  /**
   * Applies one Course domain event to the Course read models.
   *
   * Persistence decides whether the resulting projection is newer than
   * the currently stored representation.
   *
   * Search is updated only when the canonical catalog projection accepted
   * the incoming state.
   */
  async handle(event: CourseDomainEvent): Promise<void> {
    switch (event.eventName) {
      case CourseDomainEventName.CREATED:
        await this.handleCreated(event);
        return;

      case CourseDomainEventName.METADATA_UPDATED:
        await this.handleMetadataUpdated(event);
        return;

      case CourseDomainEventName.SUBMITTED_FOR_REVIEW:
      case CourseDomainEventName.CHANGES_REQUESTED:
      case CourseDomainEventName.PUBLISHED:
      case CourseDomainEventName.UNPUBLISHED:
      case CourseDomainEventName.ARCHIVED:
        await this.handleStatusChanged(event);
        return;

      default:
        this.assertNever(event);
    }
  }

  private async handleCreated(
    event: Extract<
      CourseDomainEvent,
      { eventName: typeof CourseDomainEventName.CREATED }
    >,
  ): Promise<void> {
    const occurredAt = new Date(event.occurredAt);

    const catalog = createCourseCatalogProjection({
      courseId: event.payload.courseId,
      title: event.payload.title,
      description: event.payload.description,
      level: event.payload.level,
      type: event.payload.type,
      visibility: event.payload.visibility,
      status: event.payload.status,
      instructorId: event.payload.instructorId,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });

    await this.persistProjectionPair(catalog);
  }

  private async handleMetadataUpdated(
    event: Extract<
      CourseDomainEvent,
      { eventName: typeof CourseDomainEventName.METADATA_UPDATED }
    >,
  ): Promise<void> {
    const current = await this.requireCatalogProjection(
      event.payload.courseId,
      event.eventName,
    );

    const catalog = createCourseCatalogProjection({
      courseId: current.courseId,
      title: event.payload.title,
      description: event.payload.description,
      level: event.payload.level,
      type: event.payload.type,
      visibility: event.payload.visibility,
      status: current.status,
      instructorId: current.instructorId,
      createdAt: current.createdAt,
      updatedAt: event.occurredAt,
    });

    await this.persistProjectionPair(catalog);
  }

  private async handleStatusChanged(
    event: Exclude<
      CourseDomainEvent,
      | Extract<
          CourseDomainEvent,
          { eventName: typeof CourseDomainEventName.CREATED }
        >
      | Extract<
          CourseDomainEvent,
          { eventName: typeof CourseDomainEventName.METADATA_UPDATED }
        >
    >,
  ): Promise<void> {
    const current = await this.requireCatalogProjection(
      event.payload.courseId,
      event.eventName,
    );

    const catalog = createCourseCatalogProjection({
      courseId: current.courseId,
      title: current.title,
      description: current.description,
      level: current.level,
      type: current.type,
      visibility: current.visibility,
      status: event.payload.currentStatus,
      instructorId: current.instructorId,
      createdAt: current.createdAt,
      updatedAt: event.occurredAt,
    });

    await this.persistProjectionPair(catalog);
  }

  private async requireCatalogProjection(
    courseId: string,
    eventName: string,
  ): Promise<CourseCatalogProjection> {
    const projection = await this.persistence.catalog.findByCourseId(courseId);

    if (projection === null) {
      throw new CourseProjectionSourceMissingError(courseId, eventName);
    }

    return projection;
  }

  /**
   * Persists catalog first.
   *
   * The search projection is derived only from a catalog projection that
   * was accepted by persistence.
   *
   * Consequently, an older event rejected by catalog persistence cannot
   * regress search state.
   */
  private async persistProjectionPair(
    catalog: CourseCatalogProjection,
  ): Promise<void> {
    const catalogApplied = await this.persistence.catalog.upsert(catalog);

    if (!catalogApplied) {
      return;
    }

    const search = createCourseSearchProjection(catalog);

    await this.persistence.search.upsert(search);
  }

  private assertNever(event: never): never {
    throw new Error(
      `Unsupported Course domain event "${String(
        (event as { eventName?: unknown }).eventName,
      )}".`,
    );
  }
}

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
 *
 * A projection update cannot safely reconstruct the complete canonical
 * Course read model from metadata/lifecycle events alone because those
 * events intentionally contain only the state relevant to their
 * respective transition.
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
 * This class deliberately does NOT:
 *
 * - mutate the Course aggregate;
 * - access Prisma;
 * - access PostgreSQL;
 * - access BullMQ;
 * - publish domain events;
 * - own Outbox state;
 * - perform authorization;
 * - perform query filtering;
 * - perform search ranking;
 * - generate embeddings;
 * - invoke LLMs;
 * - invoke AI agents;
 * - persist vector IDs;
 * - own recommendation state.
 *
 * The transactional Course remains the source of truth.
 *
 * 4.14-D establishes the deterministic transformation boundary.
 *
 * Replay/concurrency/idempotency policies belong to 4.14-G.
 */
export class CourseProjectionEventHandler {
  constructor(
    private readonly persistence: CourseProjectionPersistence,
  ) {}

  /**
   * Applies one Course domain event to the Course read models.
   *
   * Creation establishes the complete initial projection.
   *
   * Metadata and lifecycle events update an already-existing canonical
   * CourseCatalog projection and then deterministically derive the
   * CourseSearch projection from it.
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

  /**
   * Creates the initial canonical read model from CourseCreated.
   *
   * CourseCreated intentionally carries the complete Course state required
   * by the catalog projection except timestamps.
   *
   * The domain-event occurrence timestamp is the authoritative timestamp
   * available at this integration boundary and corresponds to the Course
   * creation operation.
   */
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

  /**
   * Applies a metadata transition to an existing canonical projection.
   *
   * MetadataUpdated intentionally does not carry lifecycle state or
   * timestamps. Those values therefore remain sourced from the existing
   * CourseCatalog projection.
   */
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

  /**
   * Applies a lifecycle transition to the existing canonical projection.
   *
   * Lifecycle events intentionally carry only previous/current status.
   * All other Course read-model fields remain sourced from the existing
   * canonical projection.
   */
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

    /*
     * The event's currentStatus is the authoritative state transition
     * represented by this event.
     *
     * The previousStatus is deliberately not written because the
     * projection stores current state, not transition history.
     */
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

  /**
   * Ensures the canonical projection exists before applying an incremental
   * event.
   *
   * A missing projection is treated as a consistency problem rather than
   * silently creating an incomplete read model.
   *
   * This is important for future:
   * - replay;
   * - reconciliation;
   * - projection rebuild;
   * - event ordering diagnostics;
   * - consistency monitoring.
   */
  private async requireCatalogProjection(
    courseId: string,
    eventName: string,
  ): Promise<CourseCatalogProjection> {
    const projection =
      await this.persistence.catalog.findByCourseId(courseId);

    if (projection === null) {
      throw new CourseProjectionSourceMissingError(courseId, eventName);
    }

    return projection;
  }

  /**
   * Persists the canonical catalog projection first and derives the search
   * projection from that exact canonical representation.
   *
   * This preserves the intended dependency:
   *
   * Course
   *   ↓
   * CourseCatalogProjection
   *   ↓
   * CourseSearchProjection
   *
   * Search state can therefore never become an independently constructed
   * Course representation.
   */
  private async persistProjectionPair(
    catalog: CourseCatalogProjection,
  ): Promise<void> {
    await this.persistence.catalog.upsert(catalog);

    const search = createCourseSearchProjection(catalog);

    await this.persistence.search.upsert(search);
  }

  /**
   * Exhaustiveness guard.
   *
   * Adding a new CourseDomainEvent without explicitly deciding how it
   * affects the Course read models will produce a compile-time failure
   * here.
   */
  private assertNever(event: never): never {
    throw new Error(
      `Unsupported Course domain event "${String(
        (event as { eventName?: unknown }).eventName,
      )}".`,
    );
  }
}
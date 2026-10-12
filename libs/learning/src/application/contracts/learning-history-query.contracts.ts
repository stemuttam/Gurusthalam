/**
 * Read contracts for durable learner activity history and streak queries.
 *
 * These are application-facing ports. They do not perform authentication,
 * authorization, HTTP handling, persistence, or streak calculations.
 *
 * Implementations must scope queries by learner identity and, when supplied,
 * tenant identity. The application boundary remains responsible for ensuring
 * that the caller is authorized to request that identity's data.
 */

export interface LearningHistoryCursor {
  /** The persisted activity occurrence timestamp. */
  readonly occurredAt: Date;
  /** Stable tie-breaker for deterministic pagination. */
  readonly eventId: string;
}

export interface ListLearningHistoryInput {
  readonly learnerId: string;
  readonly tenantId?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly cursor?: LearningHistoryCursor;
  readonly limit: number;
}

/**
 * A deliberately bounded public read shape.
 *
 * Arbitrary activity metadata and the full original payload are not exposed
 * by default. A later API contract may expose selected metadata explicitly
 * after its privacy and authorization requirements have been established.
 */
export interface LearningHistoryEntry {
  readonly eventId: string;
  readonly eventType: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly occurredAt: Date;
  readonly sessionId: string | null;
  readonly durationMs: number | null;
  readonly completionPercent: number | null;
  readonly score: number | null;
}

export interface ListLearningHistoryResult {
  readonly items: readonly LearningHistoryEntry[];
  /**
   * null means there is no next page.
   * Otherwise, the cursor identifies the final returned row.
   */
  readonly nextCursor: LearningHistoryCursor | null;
}

/**
 * Input for deriving distinct qualifying learner-local calendar days.
 *
 * The repository implementation should use PostgreSQL's timezone-aware
 * date conversion and return unique YYYY-MM-DD strings in ascending order.
 * Activities after asOf must be excluded.
 */
export interface ListQualifyingLearningActivityDaysInput {
  readonly learnerId: string;
  readonly tenantId?: string;
  readonly qualifyingEventTypes: readonly string[];
  /** Explicit IANA timezone, e.g. "Asia/Kolkata". */
  readonly timezone: string;
  /** Explicit reference instant; never use an implicit database wall clock. */
  readonly asOf: Date;
}

/**
 * Query port for durable history.
 *
 * listQualifyingActivityDays is an aggregation query, not an alternate
 * source of truth. It derives local-day keys from LearningActivityEvent
 * rows and must not mutate Progress or write streak state.
 */
export interface LearningHistoryQueryRepository {
  listHistory(
    input: ListLearningHistoryInput,
  ): Promise<ListLearningHistoryResult>;

  listQualifyingActivityDays(
    input: ListQualifyingLearningActivityDaysInput,
  ): Promise<readonly string[]>;
}

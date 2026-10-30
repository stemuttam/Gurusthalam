import {
  isAssessmentStatus,
  type AssessmentStatus,
} from '../enums/assessment-status.js';
import { AssessmentValidationError } from '../errors/index.js';

/**
 * Canonical, serialization-safe snapshot of an Assessment aggregate.
 *
 * This is the domain-owned boundary representation used to transfer
 * Assessment state between the domain and persistence adapters.
 *
 * It deliberately contains only primitive values:
 * - id: opaque Assessment identity string;
 * - status: generic Assessment lifecycle state;
 * - createdAt: canonical UTC ISO-8601 timestamp;
 * - updatedAt: canonical UTC ISO-8601 timestamp.
 *
 * Database-specific representations must be mapped to and from this
 * contract by infrastructure adapters.
 */
export interface AssessmentSnapshot {
  readonly id: string;
  readonly status: AssessmentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface SnapshotValidationIssue {
  readonly field: string;
  readonly message: string;
}

function isNonEmptyCanonicalString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim().length > 0 &&
    value.trim() === value
  );
}

/**
 * Checks whether a timestamp is in the canonical UTC ISO-8601 format
 * emitted by Date.prototype.toISOString().
 *
 * Requiring canonical representation prevents ambiguous timestamp
 * serialization and ensures deterministic snapshot round trips.
 */
function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return false;
  }

  return timestamp.toISOString() === value;
}

/**
 * Validates an unknown snapshot before aggregate rehydration.
 *
 * All detected field-level issues are reported together.
 *
 * @throws AssessmentValidationError when the snapshot is invalid.
 */
export function assertValidAssessmentSnapshot(
  value: unknown,
): asserts value is AssessmentSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AssessmentValidationError(
      'Assessment snapshot validation failed.',
      [
        {
          field: 'snapshot',
          message: 'Assessment snapshot must be a non-null object.',
        },
      ],
    );
  }

  const candidate = value as Record<string, unknown>;
  const issues: SnapshotValidationIssue[] = [];

  if (!isNonEmptyCanonicalString(candidate.id)) {
    issues.push({
      field: 'id',
      message:
        'Assessment snapshot ID must be a non-empty string without surrounding whitespace.',
    });
  }

  if (!isAssessmentStatus(candidate.status)) {
    issues.push({
      field: 'status',
      message:
        'Assessment snapshot status must be a supported lifecycle state.',
    });
  }

  if (!isCanonicalIsoTimestamp(candidate.createdAt)) {
    issues.push({
      field: 'createdAt',
      message:
        'Assessment snapshot creation timestamp must be a canonical UTC ISO-8601 timestamp.',
    });
  }

  if (!isCanonicalIsoTimestamp(candidate.updatedAt)) {
    issues.push({
      field: 'updatedAt',
      message:
        'Assessment snapshot update timestamp must be a canonical UTC ISO-8601 timestamp.',
    });
  }

  if (
    isCanonicalIsoTimestamp(candidate.createdAt) &&
    isCanonicalIsoTimestamp(candidate.updatedAt) &&
    new Date(candidate.createdAt).getTime() >
      new Date(candidate.updatedAt).getTime()
  ) {
    issues.push({
      field: 'updatedAt',
      message:
        'Assessment snapshot update timestamp cannot be earlier than its creation timestamp.',
    });
  }

  if (issues.length > 0) {
    throw new AssessmentValidationError(
      'Assessment snapshot validation failed.',
      issues,
    );
  }
}

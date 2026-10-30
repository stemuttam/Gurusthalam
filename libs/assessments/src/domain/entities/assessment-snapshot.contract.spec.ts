import { describe, expect, it } from 'vitest';

import { Assessment } from './assessment.js';

import {
  assertValidAssessmentSnapshot,
  type AssessmentSnapshot,
} from '../contracts/assessment-snapshot.js';

import { AssessmentStatus } from '../enums/assessment-status.js';

import { AssessmentValidationError } from '../errors/index.js';

import { AssessmentId } from '../identifiers/assessment-id.js';

const assessmentId = 'assessment-snapshot-001';

const createdAt = '2026-01-01T10:00:00.000Z';

const updatedAt = '2026-01-01T11:00:00.000Z';

function validSnapshot(
  overrides: Partial<AssessmentSnapshot> = {},
): AssessmentSnapshot {
  return {
    id: assessmentId,
    status: AssessmentStatus.DRAFT,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

/**
 * Simulates untrusted external or persisted input.
 *
 * This allows runtime validation to be tested without weakening
 * the strongly typed production snapshot contract.
 */
function rehydrateUntrustedSnapshot(value: unknown): Assessment {
  return Reflect.apply(Assessment.rehydrateFromSnapshot, Assessment, [
    value,
  ]) as Assessment;
}

describe('AssessmentSnapshot contract', () => {
  describe('valid snapshot', () => {
    it('accepts a valid DRAFT snapshot', () => {
      expect(() =>
        assertValidAssessmentSnapshot(validSnapshot()),
      ).not.toThrow();
    });

    it('accepts a valid PUBLISHED snapshot', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            status: AssessmentStatus.PUBLISHED,
          }),
        ),
      ).not.toThrow();
    });

    it('accepts a valid ARCHIVED snapshot', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            status: AssessmentStatus.ARCHIVED,
          }),
        ),
      ).not.toThrow();
    });

    it('accepts an opaque non-UUID Assessment identifier', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            id: 'legacy-assessment-2026-001',
          }),
        ),
      ).not.toThrow();
    });
  });

  describe('invalid snapshot structure', () => {
    it('rejects null', () => {
      expect(() => assertValidAssessmentSnapshot(null)).toThrow(
        AssessmentValidationError,
      );
    });

    it('rejects an array', () => {
      expect(() => assertValidAssessmentSnapshot([])).toThrow(
        AssessmentValidationError,
      );
    });

    it('rejects a primitive value', () => {
      expect(() => assertValidAssessmentSnapshot('invalid')).toThrow(
        AssessmentValidationError,
      );
    });

    it('rejects an empty Assessment identifier', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            id: '',
          }),
        ),
      ).toThrow(AssessmentValidationError);
    });

    it('rejects an identifier containing only whitespace', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            id: '   ',
          }),
        ),
      ).toThrow(AssessmentValidationError);
    });

    it('rejects an identifier with surrounding whitespace', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            id: ' assessment-001 ',
          }),
        ),
      ).toThrow(AssessmentValidationError);
    });

    it('rejects an unsupported lifecycle status', () => {
      expect(() =>
        assertValidAssessmentSnapshot({
          ...validSnapshot(),
          status: 'INVALID',
        }),
      ).toThrow(AssessmentValidationError);
    });
  });

  describe('timestamp validation', () => {
    it('rejects an invalid creation timestamp', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            createdAt: 'not-a-date',
          }),
        ),
      ).toThrow(AssessmentValidationError);
    });

    it('rejects an invalid update timestamp', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            updatedAt: 'not-a-date',
          }),
        ),
      ).toThrow(AssessmentValidationError);
    });

    it('rejects a non-canonical timestamp with an explicit offset', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            createdAt: '2026-01-01T11:00:00+01:00',
          }),
        ),
      ).toThrow(AssessmentValidationError);
    });

    it('rejects a timestamp without millisecond precision', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            createdAt: '2026-01-01T10:00:00Z',
          }),
        ),
      ).toThrow(AssessmentValidationError);
    });

    it('rejects updatedAt earlier than createdAt', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            createdAt: '2026-01-02T10:00:00.000Z',
            updatedAt: '2026-01-01T10:00:00.000Z',
          }),
        ),
      ).toThrow(AssessmentValidationError);
    });

    it('accepts equal creation and update timestamps', () => {
      expect(() =>
        assertValidAssessmentSnapshot(
          validSnapshot({
            createdAt,
            updatedAt: createdAt,
          }),
        ),
      ).not.toThrow();
    });
  });

  describe('validation diagnostics', () => {
    it('reports all invalid snapshot fields together', () => {
      try {
        assertValidAssessmentSnapshot({
          id: ' ',
          status: 'INVALID',
          createdAt: 'invalid-created-at',
          updatedAt: 'invalid-updated-at',
        });

        throw new Error('Expected snapshot validation to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(AssessmentValidationError);

        if (!(error instanceof AssessmentValidationError)) {
          throw error;
        }

        expect(error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'id',
            }),
            expect.objectContaining({
              field: 'status',
            }),
            expect.objectContaining({
              field: 'createdAt',
            }),
            expect.objectContaining({
              field: 'updatedAt',
            }),
          ]),
        );
      }
    });
  });
});

describe('Assessment snapshot serialization', () => {
  it('returns only serialization-safe primitive fields', () => {
    const assessment = Assessment.create();

    const snapshot = assessment.toSnapshot();

    expect(snapshot).toEqual({
      id: assessment.id.toString(),
      status: AssessmentStatus.DRAFT,
      createdAt: assessment.createdAt.toISOString(),
      updatedAt: assessment.updatedAt.toISOString(),
    });

    expect(snapshot.id).toEqual(expect.any(String));
    expect(snapshot.createdAt).toEqual(expect.any(String));
    expect(snapshot.updatedAt).toEqual(expect.any(String));

    expect(snapshot.id).not.toBeInstanceOf(AssessmentId);
    expect(snapshot.createdAt).not.toBeInstanceOf(Date);
    expect(snapshot.updatedAt).not.toBeInstanceOf(Date);
  });

  it('returns a JSON-serializable snapshot', () => {
    const assessment = Assessment.create();

    const snapshot = assessment.toSnapshot();

    expect(() => JSON.stringify(snapshot)).not.toThrow();

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('returns a new snapshot object on every call', () => {
    const assessment = Assessment.create();

    const first = assessment.toSnapshot();
    const second = assessment.toSnapshot();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it('returns an immutable snapshot object', () => {
    const assessment = Assessment.create();

    const snapshot = assessment.toSnapshot();

    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('does not include domain events or specialized assessment content', () => {
    const assessment = Assessment.create();

    const snapshot = assessment.toSnapshot();

    expect(snapshot).not.toHaveProperty('events');
    expect(snapshot).not.toHaveProperty('questions');
    expect(snapshot).not.toHaveProperty('answerKey');
    expect(snapshot).not.toHaveProperty('grading');
    expect(snapshot).not.toHaveProperty('attempts');
  });
});

describe('Assessment snapshot rehydration', () => {
  it('rehydrates a valid DRAFT snapshot', () => {
    const assessment = Assessment.rehydrateFromSnapshot(validSnapshot());

    expect(assessment.status).toBe(AssessmentStatus.DRAFT);
    expect(assessment.id.toString()).toBe(assessmentId);
  });

  it('rehydrates a valid PUBLISHED snapshot', () => {
    const assessment = Assessment.rehydrateFromSnapshot(
      validSnapshot({
        status: AssessmentStatus.PUBLISHED,
      }),
    );

    expect(assessment.status).toBe(AssessmentStatus.PUBLISHED);
  });

  it('rehydrates a valid ARCHIVED snapshot', () => {
    const assessment = Assessment.rehydrateFromSnapshot(
      validSnapshot({
        status: AssessmentStatus.ARCHIVED,
      }),
    );

    expect(assessment.status).toBe(AssessmentStatus.ARCHIVED);
  });

  it('preserves the original Assessment identity', () => {
    const assessment = Assessment.rehydrateFromSnapshot(validSnapshot());

    expect(assessment.id.toString()).toBe(assessmentId);
  });

  it('preserves creation timestamp exactly', () => {
    const assessment = Assessment.rehydrateFromSnapshot(validSnapshot());

    expect(assessment.createdAt.toISOString()).toBe(createdAt);
  });

  it('preserves update timestamp exactly', () => {
    const assessment = Assessment.rehydrateFromSnapshot(validSnapshot());

    expect(assessment.updatedAt.toISOString()).toBe(updatedAt);
  });

  it('does not change lifecycle state during rehydration', () => {
    const assessment = Assessment.rehydrateFromSnapshot(
      validSnapshot({
        status: AssessmentStatus.PUBLISHED,
      }),
    );

    expect(assessment.status).toBe(AssessmentStatus.PUBLISHED);
  });

  it('rejects an invalid snapshot before constructing the aggregate', () => {
    expect(() =>
      rehydrateUntrustedSnapshot({
        id: ' ',
        status: 'INVALID',
        createdAt: 'invalid',
        updatedAt: 'invalid',
      }),
    ).toThrow(AssessmentValidationError);
  });

  it('does not accept a snapshot with a missing identity', () => {
    expect(() =>
      rehydrateUntrustedSnapshot({
        status: AssessmentStatus.DRAFT,
        createdAt,
        updatedAt,
      }),
    ).toThrow(AssessmentValidationError);
  });

  it('does not accept a snapshot with a missing lifecycle status', () => {
    expect(() =>
      rehydrateUntrustedSnapshot({
        id: assessmentId,
        createdAt,
        updatedAt,
      }),
    ).toThrow(AssessmentValidationError);
  });

  it('does not accept Date objects in place of timestamp strings', () => {
    expect(() =>
      rehydrateUntrustedSnapshot({
        id: assessmentId,
        status: AssessmentStatus.DRAFT,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
      }),
    ).toThrow(AssessmentValidationError);
  });

  it('does not mutate the supplied snapshot during rehydration', () => {
    const snapshot = validSnapshot();
    const original = { ...snapshot };

    Assessment.rehydrateFromSnapshot(snapshot);

    expect(snapshot).toEqual(original);
  });

  it('isolates the aggregate from later changes to the supplied snapshot', () => {
    const snapshot = validSnapshot();

    const assessment = Assessment.rehydrateFromSnapshot(snapshot);

    const mutableSnapshot = snapshot as {
      id: string;
      status: AssessmentSnapshot['status'];
      createdAt: string;
      updatedAt: string;
    };

    mutableSnapshot.id = 'another-assessment';
    mutableSnapshot.status = AssessmentStatus.ARCHIVED;
    mutableSnapshot.createdAt = '2026-01-03T10:00:00.000Z';

    expect(assessment.id.toString()).toBe(assessmentId);
    expect(assessment.status).toBe(AssessmentStatus.DRAFT);
    expect(assessment.createdAt.toISOString()).toBe(createdAt);
  });
});

describe('Assessment snapshot round-trip invariants', () => {
  it('preserves complete DRAFT state through a round trip', () => {
    const assessment = Assessment.create();

    const original = assessment.toSnapshot();

    const roundTrip = Assessment.rehydrateFromSnapshot(original).toSnapshot();

    expect(roundTrip).toEqual(original);
  });

  it('preserves complete PUBLISHED state through a round trip', () => {
    const assessment = Assessment.create();

    assessment.publish();

    const original = assessment.toSnapshot();

    const roundTrip = Assessment.rehydrateFromSnapshot(original).toSnapshot();

    expect(roundTrip).toEqual(original);
  });

  it('preserves complete ARCHIVED state through a round trip', () => {
    const assessment = Assessment.create();

    assessment.publish();
    assessment.archive();

    const original = assessment.toSnapshot();

    const roundTrip = Assessment.rehydrateFromSnapshot(original).toSnapshot();

    expect(roundTrip).toEqual(original);
  });

  it('remains stable through repeated snapshot rehydration', () => {
    const assessment = Assessment.create();

    assessment.publish();
    assessment.archive();

    const first = assessment.toSnapshot();

    const second = Assessment.rehydrateFromSnapshot(first).toSnapshot();

    const third = Assessment.rehydrateFromSnapshot(second).toSnapshot();

    expect(second).toEqual(first);
    expect(third).toEqual(second);
    expect(third).toEqual(first);
  });

  it('allows valid lifecycle progression after snapshot rehydration', () => {
    const assessment = Assessment.rehydrateFromSnapshot(validSnapshot());

    assessment.publish();

    expect(assessment.status).toBe(AssessmentStatus.PUBLISHED);
  });

  it('allows valid archival after rehydration from PUBLISHED', () => {
    const assessment = Assessment.rehydrateFromSnapshot(
      validSnapshot({
        status: AssessmentStatus.PUBLISHED,
      }),
    );

    assessment.archive();

    expect(assessment.status).toBe(AssessmentStatus.ARCHIVED);
  });

  it('does not mutate the original aggregate when the rehydrated instance changes', () => {
    const original = Assessment.create();

    const rehydrated = Assessment.rehydrateFromSnapshot(original.toSnapshot());

    rehydrated.publish();

    expect(original.status).toBe(AssessmentStatus.DRAFT);
    expect(rehydrated.status).toBe(AssessmentStatus.PUBLISHED);
  });

  it('does not expose domain-event data in the snapshot after rehydration', () => {
    const assessment = Assessment.rehydrateFromSnapshot(validSnapshot());

    const snapshot = assessment.toSnapshot();

    expect(Object.keys(snapshot).sort()).toEqual([
      'createdAt',
      'id',
      'status',
      'updatedAt',
    ]);
  });
});

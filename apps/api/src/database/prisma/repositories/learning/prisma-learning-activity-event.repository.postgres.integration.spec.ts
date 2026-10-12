import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  LearningActivityEventIdentityConflictError,
  type ValidatedLearningActivityEvent,
} from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';

import { PrismaLearningActivityEventRepository } from './prisma-learning-activity-event.repository.js';

const TEST_NAMESPACE = `phase-5-8-d-activity-history-${process.pid}-${randomUUID()}`;

const prisma = new PrismaService();

const repository = new PrismaLearningActivityEventRepository(prisma);

function createEvent(suffix: string): ValidatedLearningActivityEvent {
  return {
    eventId: `${TEST_NAMESPACE}:${suffix}:${randomUUID()}`,
    learnerId: `${TEST_NAMESPACE}:learner`,
    tenantId: `${TEST_NAMESPACE}:tenant`,
    sessionId: `${TEST_NAMESPACE}:session`,
    eventType: 'lesson_opened',
    entityType: 'lesson',
    entityId: `${TEST_NAMESPACE}:lesson-1`,
    timestamp: '2026-10-12T10:30:00.000Z',
    context: {
      deviceType: 'desktop',
      platform: 'web',
    },
    metrics: {
      durationMs: 1200,
      completionPercent: 10,
    },
    metadata: {
      source: 'course_player',
      flags: {
        resumed: false,
        autoplay: false,
      },
    },
  };
}

async function countByEventId(eventId: string): Promise<number> {
  return prisma.learningActivityEvent.count({
    where: { eventId },
  });
}

async function findByEventId(eventId: string) {
  return prisma.learningActivityEvent.findUnique({
    where: { eventId },
  });
}

describe('PrismaLearningActivityEventRepository - PostgreSQL integration - Phase 5.8-D', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    try {
      /*
       * All event IDs created by this suite use a unique namespace.
       * Cleanup is scoped to that namespace and cannot delete unrelated
       * learner activity records.
       */
      await prisma.learningActivityEvent.deleteMany({
        where: {
          eventId: {
            startsWith: `${TEST_NAMESPACE}:`,
          },
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('persists the complete event payload and indexed fields', async () => {
    const event = createEvent('round-trip');

    const result = await repository.record(event);

    expect(result).toEqual({ status: 'created' });

    const persisted = await findByEventId(event.eventId);

    expect(persisted).not.toBeNull();

    expect(persisted?.eventId).toBe(event.eventId);
    expect(persisted?.learnerId).toBe(event.learnerId);
    expect(persisted?.tenantId).toBe(event.tenantId);
    expect(persisted?.sessionId).toBe(event.sessionId);
    expect(persisted?.eventType).toBe(event.eventType);
    expect(persisted?.entityType).toBe(event.entityType);
    expect(persisted?.entityId).toBe(event.entityId);
    expect(persisted?.occurredAt).toEqual(new Date(event.timestamp));

    expect(persisted?.context).toEqual(event.context);
    expect(persisted?.metrics).toEqual(event.metrics);
    expect(persisted?.metadata).toEqual(event.metadata);
    expect(persisted?.payload).toEqual(event);

    expect(persisted?.receivedAt).toBeInstanceOf(Date);

    expect(await countByEventId(event.eventId)).toBe(1);
  });

  it('treats a concurrent identical retry as idempotent', async () => {
    const event = createEvent('concurrent-identical');

    const results = await Promise.all([
      repository.record(event),
      repository.record(event),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'created',
      'duplicate',
    ]);

    expect(await countByEventId(event.eventId)).toBe(1);

    const persisted = await findByEventId(event.eventId);

    expect(persisted?.payload).toEqual(event);
  });

  it('treats equivalent JSON payloads with different key order as duplicates', async () => {
    const event = createEvent('json-key-order');

    expect(await repository.record(event)).toEqual({
      status: 'created',
    });

    const reorderedEvent: ValidatedLearningActivityEvent = {
      ...event,
      context: {
        platform: 'web',
        deviceType: 'desktop',
      },
      metadata: {
        flags: {
          autoplay: false,
          resumed: false,
        },
        source: 'course_player',
      },
    };

    expect(await repository.record(reorderedEvent)).toEqual({
      status: 'duplicate',
    });

    expect(await countByEventId(event.eventId)).toBe(1);
  });

  it('rejects conflicting event identity reuse without overwriting the original', async () => {
    const original = createEvent('identity-conflict');

    expect(await repository.record(original)).toEqual({
      status: 'created',
    });

    const conflicting: ValidatedLearningActivityEvent = {
      ...original,
      entityId: `${TEST_NAMESPACE}:different-lesson`,
    };

    await expect(repository.record(conflicting)).rejects.toBeInstanceOf(
      LearningActivityEventIdentityConflictError,
    );

    const persisted = await findByEventId(original.eventId);

    expect(persisted?.payload).toEqual(original);
    expect(persisted?.entityId).toBe(original.entityId);

    expect(await countByEventId(original.eventId)).toBe(1);
  });

  it('allows only one winner when conflicting payloads race on a new event ID', async () => {
    const original = createEvent('initial-conflicting-race');

    const conflicting: ValidatedLearningActivityEvent = {
      ...original,
      entityId: `${TEST_NAMESPACE}:competing-lesson`,
    };

    const results = await Promise.allSettled([
      repository.record(original),
      repository.record(conflicting),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');

    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const successfulResult = fulfilled[0];

    expect(successfulResult?.status).toBe('fulfilled');

    if (successfulResult?.status === 'fulfilled') {
      expect(successfulResult.value).toEqual({
        status: 'created',
      });
    }

    const failedResult = rejected[0];

    expect(failedResult?.status).toBe('rejected');

    if (failedResult?.status === 'rejected') {
      expect(failedResult.reason).toBeInstanceOf(
        LearningActivityEventIdentityConflictError,
      );
    }

    const persisted = await findByEventId(original.eventId);

    expect(persisted).not.toBeNull();

    /*
     * Whichever concurrent insert wins becomes the immutable stored
     * event. The losing payload must not overwrite it.
     */
    expect([original.entityId, conflicting.entityId]).toContain(
      persisted?.entityId,
    );

    expect(persisted?.payload).toEqual(
      persisted?.entityId === original.entityId ? original : conflicting,
    );

    expect(await countByEventId(original.eventId)).toBe(1);
  });

  it('rejects concurrent conflicting retries against an existing event', async () => {
    const original = createEvent('concurrent-conflicting-retries');

    expect(await repository.record(original)).toEqual({
      status: 'created',
    });

    const conflictingA: ValidatedLearningActivityEvent = {
      ...original,
      entityId: `${TEST_NAMESPACE}:conflict-a`,
    };

    const conflictingB: ValidatedLearningActivityEvent = {
      ...original,
      metadata: {
        source: 'different_source',
        flags: {
          resumed: true,
          autoplay: false,
        },
      },
    };

    const results = await Promise.allSettled([
      repository.record(conflictingA),
      repository.record(conflictingB),
    ]);

    expect(results).toHaveLength(2);

    for (const result of results) {
      expect(result.status).toBe('rejected');

      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(
          LearningActivityEventIdentityConflictError,
        );
      }
    }

    const persisted = await findByEventId(original.eventId);

    expect(persisted?.payload).toEqual(original);
    expect(persisted?.entityId).toBe(original.entityId);

    expect(await countByEventId(original.eventId)).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';

import {
  InvalidLearningSessionTransitionError,
  LearningSession,
  LearningSessionDomainEventName,
  LearningSessionStatus,
  LearningSessionValidationError,
} from './index.js';

const CREATED_AT = new Date('2026-01-01T10:00:00.000Z');

function createSession() {
  return LearningSession.create({
    enrollmentId: 'enrollment-1',
    now: CREATED_AT,
  });
}

/**
 * Returns a domain event that is required by the test.
 *
 * The aggregate exposes domain events through an array. Because the
 * project uses strict TypeScript indexed-access checking, direct
 * array access is correctly typed as possibly undefined.
 *
 * This helper establishes the runtime invariant explicitly instead
 * of weakening the test with a non-null assertion (`!`).
 */
function getRequiredEvent(session: LearningSession, index: number) {
  const event = session.getDomainEvents()[index];

  if (!event) {
    throw new Error(`Expected domain event at index ${index}.`);
  }

  return event;
}

describe('LearningSession', () => {
  it('creates an active session and emits a started event', () => {
    const session = createSession();

    expect(session.status).toBe(LearningSessionStatus.ACTIVE);
    expect(session.enrollmentId).toBe('enrollment-1');
    expect(session.startedAt).toEqual(CREATED_AT);
    expect(session.pausedAt).toBeNull();
    expect(session.endedAt).toBeNull();

    const events = session.getDomainEvents();

    expect(events).toHaveLength(1);

    const startedEvent = getRequiredEvent(session, 0);

    expect(startedEvent).toMatchObject({
      eventName: LearningSessionDomainEventName.STARTED,
      eventVersion: 1,
      aggregateId: session.id,
      occurredAt: CREATED_AT,
      payload: {
        sessionId: session.id,
        enrollmentId: 'enrollment-1',
        status: LearningSessionStatus.ACTIVE,
        startedAt: CREATED_AT,
      },
    });
  });

  it('pauses an active session and emits a lifecycle event', () => {
    const session = createSession();
    const pausedAt = new Date('2026-01-01T10:15:00.000Z');

    session.pause(pausedAt);

    expect(session.status).toBe(LearningSessionStatus.PAUSED);
    expect(session.pausedAt).toEqual(pausedAt);
    expect(session.endedAt).toBeNull();

    const pausedEvent = getRequiredEvent(session, 1);

    expect(pausedEvent).toMatchObject({
      eventName: LearningSessionDomainEventName.PAUSED,
      payload: {
        previousStatus: LearningSessionStatus.ACTIVE,
        currentStatus: LearningSessionStatus.PAUSED,
      },
    });
  });

  it('resumes a paused session and clears the active pause timestamp', () => {
    const session = createSession();
    const pausedAt = new Date('2026-01-01T10:15:00.000Z');
    const resumedAt = new Date('2026-01-01T10:30:00.000Z');

    session.pause(pausedAt);
    session.resume(resumedAt);

    expect(session.status).toBe(LearningSessionStatus.ACTIVE);
    expect(session.pausedAt).toBeNull();

    const resumedEvent = getRequiredEvent(session, 2);

    expect(resumedEvent).toMatchObject({
      eventName: LearningSessionDomainEventName.RESUMED,
      occurredAt: resumedAt,
      payload: {
        previousStatus: LearningSessionStatus.PAUSED,
        currentStatus: LearningSessionStatus.ACTIVE,
      },
    });
  });

  it('completes an active session', () => {
    const session = createSession();
    const completedAt = new Date('2026-01-01T10:45:00.000Z');

    session.complete(completedAt);

    expect(session.status).toBe(LearningSessionStatus.COMPLETED);
    expect(session.endedAt).toEqual(completedAt);
    expect(session.pausedAt).toBeNull();

    const completedEvent = getRequiredEvent(session, 1);

    expect(completedEvent).toMatchObject({
      eventName: LearningSessionDomainEventName.COMPLETED,
      occurredAt: completedAt,
      payload: {
        previousStatus: LearningSessionStatus.ACTIVE,
        currentStatus: LearningSessionStatus.COMPLETED,
      },
    });
  });

  it('completes a paused session', () => {
    const session = createSession();
    const pausedAt = new Date('2026-01-01T10:15:00.000Z');
    const completedAt = new Date('2026-01-01T10:45:00.000Z');

    session.pause(pausedAt);
    session.complete(completedAt);

    expect(session.status).toBe(LearningSessionStatus.COMPLETED);
    expect(session.endedAt).toEqual(completedAt);
    expect(session.pausedAt).toBeNull();
  });

  it('abandons an active session', () => {
    const session = createSession();
    const abandonedAt = new Date('2026-01-01T11:00:00.000Z');

    session.abandon(abandonedAt);

    expect(session.status).toBe(LearningSessionStatus.ABANDONED);
    expect(session.endedAt).toEqual(abandonedAt);

    const abandonedEvent = getRequiredEvent(session, 1);

    expect(abandonedEvent).toMatchObject({
      eventName: LearningSessionDomainEventName.ABANDONED,
      occurredAt: abandonedAt,
      payload: {
        previousStatus: LearningSessionStatus.ACTIVE,
        currentStatus: LearningSessionStatus.ABANDONED,
      },
    });
  });

  it('abandons a paused session', () => {
    const session = createSession();
    const pausedAt = new Date('2026-01-01T10:15:00.000Z');
    const abandonedAt = new Date('2026-01-01T11:00:00.000Z');

    session.pause(pausedAt);
    session.abandon(abandonedAt);

    expect(session.status).toBe(LearningSessionStatus.ABANDONED);
    expect(session.endedAt).toEqual(abandonedAt);
    expect(session.pausedAt).toBeNull();
  });

  it.each([
    [LearningSessionStatus.ACTIVE, 'resume'],
    [LearningSessionStatus.PAUSED, 'pause'],
    [LearningSessionStatus.COMPLETED, 'pause'],
    [LearningSessionStatus.COMPLETED, 'resume'],
    [LearningSessionStatus.COMPLETED, 'complete'],
    [LearningSessionStatus.COMPLETED, 'abandon'],
    [LearningSessionStatus.ABANDONED, 'pause'],
    [LearningSessionStatus.ABANDONED, 'resume'],
    [LearningSessionStatus.ABANDONED, 'complete'],
    [LearningSessionStatus.ABANDONED, 'abandon'],
  ])('rejects invalid transition from %s using %s', (status, operation) => {
    const session =
      status === LearningSessionStatus.ACTIVE
        ? createSession()
        : LearningSession.rehydrate({
            id: 'session-1',
            enrollmentId: 'enrollment-1',
            status,
            startedAt: CREATED_AT,
            pausedAt:
              status === LearningSessionStatus.PAUSED
                ? new Date('2026-01-01T10:15:00.000Z')
                : null,
            endedAt:
              status === LearningSessionStatus.COMPLETED ||
              status === LearningSessionStatus.ABANDONED
                ? new Date('2026-01-01T11:00:00.000Z')
                : null,
            createdAt: CREATED_AT,
            updatedAt: new Date('2026-01-01T11:00:00.000Z'),
          });

    expect(() => {
      if (operation === 'pause') {
        session.pause(new Date('2026-01-01T11:15:00.000Z'));
      } else if (operation === 'resume') {
        session.resume(new Date('2026-01-01T11:15:00.000Z'));
      } else if (operation === 'complete') {
        session.complete(new Date('2026-01-01T11:15:00.000Z'));
      } else {
        session.abandon(new Date('2026-01-01T11:15:00.000Z'));
      }
    }).toThrow(InvalidLearningSessionTransitionError);
  });

  it('rejects invalid timestamps before mutation', () => {
    const session = createSession();

    expect(() => session.pause(new Date('invalid'))).toThrow(
      LearningSessionValidationError,
    );

    expect(session.status).toBe(LearningSessionStatus.ACTIVE);
    expect(session.getDomainEvents()).toHaveLength(1);
  });

  it('rejects a transition timestamp before creation', () => {
    const session = createSession();

    expect(() => session.pause(new Date('2025-12-31T23:59:59.999Z'))).toThrow(
      LearningSessionValidationError,
    );

    expect(session.status).toBe(LearningSessionStatus.ACTIVE);
    expect(session.getDomainEvents()).toHaveLength(1);
  });

  it('rehydrates valid ACTIVE state', () => {
    const session = LearningSession.rehydrate({
      id: 'session-1',
      enrollmentId: 'enrollment-1',
      status: LearningSessionStatus.ACTIVE,
      startedAt: CREATED_AT,
      pausedAt: null,
      endedAt: null,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });

    expect(session.toPrimitives()).toEqual({
      id: 'session-1',
      enrollmentId: 'enrollment-1',
      status: LearningSessionStatus.ACTIVE,
      startedAt: CREATED_AT,
      pausedAt: null,
      endedAt: null,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });

    expect(session.getDomainEvents()).toHaveLength(0);
  });

  it('does not leak mutable Date references', () => {
    const session = createSession();
    const startedAt = session.startedAt;

    startedAt.setUTCFullYear(2030);

    expect(session.startedAt).toEqual(CREATED_AT);
  });

  it('returns defensive copies of domain events', () => {
    const session = createSession();

    const event = getRequiredEvent(session, 0);

    event.occurredAt.setUTCFullYear(2030);

    (event.payload as { startedAt: Date }).startedAt.setUTCFullYear(2030);

    const currentEvent = getRequiredEvent(session, 0);

    expect(currentEvent.occurredAt).toEqual(CREATED_AT);
    expect((currentEvent.payload as { startedAt: Date }).startedAt).toEqual(
      CREATED_AT,
    );
  });

  it('pulls and drains domain events', () => {
    const session = createSession();

    expect(session.pullDomainEvents()).toHaveLength(1);
    expect(session.getDomainEvents()).toHaveLength(0);
  });

  it('preserves event identity and aggregate identity', () => {
    const session = createSession();

    const event = getRequiredEvent(session, 0);

    expect(event.eventId).toEqual(expect.any(String));
    expect(event.aggregateId).toBe(session.id);
    expect(event.eventVersion).toBe(1);
  });

  it('rejects invalid rehydrated terminal state', () => {
    expect(() =>
      LearningSession.rehydrate({
        id: 'session-1',
        enrollmentId: 'enrollment-1',
        status: LearningSessionStatus.COMPLETED,
        startedAt: CREATED_AT,
        pausedAt: new Date('2026-01-01T10:15:00.000Z'),
        endedAt: new Date('2026-01-01T11:00:00.000Z'),
        createdAt: CREATED_AT,
        updatedAt: new Date('2026-01-01T11:00:00.000Z'),
      }),
    ).toThrow(LearningSessionValidationError);
  });

  it('rejects an invalid identifier', () => {
    expect(() =>
      LearningSession.rehydrate({
        id: ' ',
        enrollmentId: 'enrollment-1',
        status: LearningSessionStatus.ACTIVE,
        startedAt: CREATED_AT,
        pausedAt: null,
        endedAt: null,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      }),
    ).toThrow(LearningSessionValidationError);
  });
});

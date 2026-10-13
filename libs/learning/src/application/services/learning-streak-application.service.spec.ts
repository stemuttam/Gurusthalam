import { describe, expect, it, vi } from 'vitest';

import type { LearningHistoryQueryRepository } from '../contracts/learning-history-query.contracts.js';

import { LearningStreakApplicationError } from './learning-streak-application.service.js';

import { DefaultLearningStreakApplicationService } from './learning-streak-application.service.js';

const AS_OF = '2026-10-13T08:00:00.000Z';

function createRepositoryMock() {
  const listHistory = vi.fn();
  const listQualifyingActivityDays = vi.fn();

  const repository: LearningHistoryQueryRepository = {
    listHistory,
    listQualifyingActivityDays,
  };

  return { repository, listHistory, listQualifyingActivityDays };
}

describe('DefaultLearningStreakApplicationService', () => {
  it('calculates streaks from repository day keys using the fixed allowlist', async () => {
    const { repository, listQualifyingActivityDays, listHistory } =
      createRepositoryMock();

    listQualifyingActivityDays.mockResolvedValue([
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]);

    const service = new DefaultLearningStreakApplicationService(repository);

    const result = await service.getLearningStreak({
      learnerId: 'learner-1',
      timezone: 'Asia/Kolkata',
      asOf: AS_OF,
    });

    expect(result).toMatchObject({
      timezone: 'Asia/Kolkata',
      asOfDate: '2026-10-13',
      qualifyingActivityDays: ['2026-10-10', '2026-10-11', '2026-10-12'],
      lastActivityDate: '2026-10-12',
      hasActivityToday: false,
      isCurrentStreakActive: true,
      currentStreakDays: 3,
      longestStreakDays: 3,
    });

    expect(listQualifyingActivityDays).toHaveBeenCalledTimes(1);
    expect(listQualifyingActivityDays).toHaveBeenCalledWith(
      expect.objectContaining({
        learnerId: 'learner-1',
        timezone: 'Asia/Kolkata',
        asOf: new Date(AS_OF),
        qualifyingEventTypes: expect.arrayContaining([
          'video_completed',
          'question_answered',
          'quiz_completed',
          'assignment_submitted',
          'assessment_passed',
          'skill_practiced',
          'skill_mastered',
          'discussion_created',
          'discussion_replied',
          'ai_tutor_used',
        ]),
      }),
    );
    expect(listHistory).not.toHaveBeenCalled();
  });

  it('preserves tenant scope when supplied', async () => {
    const { repository, listQualifyingActivityDays } = createRepositoryMock();

    listQualifyingActivityDays.mockResolvedValue([]);

    const service = new DefaultLearningStreakApplicationService(repository);

    await service.getLearningStreak({
      learnerId: 'learner-1',
      tenantId: 'tenant-1',
      timezone: 'UTC',
      asOf: AS_OF,
    });

    expect(listQualifyingActivityDays).toHaveBeenCalledWith(
      expect.objectContaining({
        learnerId: 'learner-1',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('omits tenant scope when it is not supplied', async () => {
    const { repository, listQualifyingActivityDays } = createRepositoryMock();

    listQualifyingActivityDays.mockResolvedValue([]);

    const service = new DefaultLearningStreakApplicationService(repository);

    await service.getLearningStreak({
      learnerId: 'learner-1',
      timezone: 'UTC',
      asOf: AS_OF,
    });

    const input = listQualifyingActivityDays.mock.calls[0]?.[0];

    expect(input).toBeDefined();
    expect(input).not.toHaveProperty('tenantId');
  });

  it('returns zero streak values when no qualifying days exist', async () => {
    const { repository, listQualifyingActivityDays } = createRepositoryMock();

    listQualifyingActivityDays.mockResolvedValue([]);

    const service = new DefaultLearningStreakApplicationService(repository);

    await expect(
      service.getLearningStreak({
        learnerId: 'learner-1',
        timezone: 'UTC',
        asOf: AS_OF,
      }),
    ).resolves.toMatchObject({
      qualifyingActivityDays: [],
      lastActivityDate: null,
      hasActivityToday: false,
      isCurrentStreakActive: false,
      currentStreakDays: 0,
      longestStreakDays: 0,
    });
  });

  it('rejects malformed input before querying the repository', async () => {
    const { repository, listQualifyingActivityDays } = createRepositoryMock();

    const service = new DefaultLearningStreakApplicationService(repository);

    await expect(
      service.getLearningStreak({
        learnerId: ' ',
        timezone: 'UTC',
        asOf: AS_OF,
      }),
    ).rejects.toBeInstanceOf(LearningStreakApplicationError);

    await expect(
      service.getLearningStreak({
        learnerId: 'learner-1',
        timezone: 'Not/A_Real_Timezone',
        asOf: AS_OF,
      }),
    ).rejects.toBeInstanceOf(LearningStreakApplicationError);

    await expect(
      service.getLearningStreak({
        learnerId: 'learner-1',
        timezone: 'UTC',
        asOf: 'not-a-date',
      }),
    ).rejects.toBeInstanceOf(LearningStreakApplicationError);

    await expect(
      service.getLearningStreak({
        learnerId: 'learner-1',
        timezone: 'UTC',
        asOf: AS_OF,
        unexpected: true,
      } as never),
    ).rejects.toBeInstanceOf(LearningStreakApplicationError);

    expect(listQualifyingActivityDays).not.toHaveBeenCalled();
  });

  it('propagates repository failures rather than returning an empty streak', async () => {
    const { repository, listQualifyingActivityDays } = createRepositoryMock();

    const repositoryError = new Error('history database unavailable');
    listQualifyingActivityDays.mockRejectedValue(repositoryError);

    const service = new DefaultLearningStreakApplicationService(repository);

    await expect(
      service.getLearningStreak({
        learnerId: 'learner-1',
        timezone: 'UTC',
        asOf: AS_OF,
      }),
    ).rejects.toBe(repositoryError);
  });

  it('does not call the history repository or mutate persistence state', async () => {
    const { repository, listHistory, listQualifyingActivityDays } =
      createRepositoryMock();

    listQualifyingActivityDays.mockResolvedValue([]);

    const service = new DefaultLearningStreakApplicationService(repository);

    await service.getLearningStreak({
      learnerId: 'learner-1',
      timezone: 'UTC',
      asOf: AS_OF,
    });

    expect(listHistory).not.toHaveBeenCalled();
    expect(listQualifyingActivityDays).toHaveBeenCalledTimes(1);
    expect(repository).not.toHaveProperty('save');
  });
});

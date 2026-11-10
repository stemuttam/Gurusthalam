
import { describe, expect, it, vi } from 'vitest';

import {
  AnswerFormat,
  QuestionId,
  QuestionLifecycleApplicationService,
  QuestionOwnership,
  QuestionType,
  QuestionVersionId,
  QuestionVersionLineage,
  QuestionVersionNumber,
  QuestionVersionReference,
  createQuestionVersionSnapshot,
  type AnyQuestionVersionSnapshotInput,
  type QuestionLifecycleRepository,
  type QuestionVersionSnapshot,
  type QuestionVersionContent,
  type QuestionVersionAnswerKey,
} from '../index.js';

const questionId = QuestionId.from('question-restore-regression');

function snapshot(
  versionIdValue: string,
  versionNumberValue: number,
  previous?: QuestionVersionSnapshot,
): QuestionVersionSnapshot {
  const id = QuestionVersionId.from(versionIdValue);
  const versionNumber = QuestionVersionNumber.from(versionNumberValue);

  const current = QuestionVersionReference.create(
    id,
    questionId,
    versionNumber,
  );

  const previousReference =
    previous === undefined
      ? null
      : QuestionVersionReference.create(
          previous.id,
          previous.questionId,
          previous.versionNumber,
        );

  return createQuestionVersionSnapshot({
    id,
    questionId,
    versionNumber,
    questionType: QuestionType.SINGLE_CHOICE,
    answerFormat: AnswerFormat.SELECTED_OPTION,
    content: {
      questionType: QuestionType.SINGLE_CHOICE,
      prompt: { text: 'Which is a planet?' },
      options: [
        { id: `${versionIdValue}-earth`, text: 'Earth' },
        { id: `${versionIdValue}-moon`, text: 'Moon' },
      ],
    },
    answerKey: {
      questionType: QuestionType.SINGLE_CHOICE,
      correctOptionId: `${versionIdValue}-earth`,
    },
    lineage: QuestionVersionLineage.create(
      current,
      previousReference,
      null,
    ),
    createdAt: new Date(`2026-01-0${versionNumberValue}T00:00:00.000Z`),
  } as AnyQuestionVersionSnapshotInput);
}

describe('QuestionLifecycleApplicationService.restore', () => {
  it('creates new option identities and remaps the answer-key reference', async () => {
    const source = snapshot('restore-source-v1', 1);
    const latest = snapshot('restore-latest-v2', 2, source);

    let persisted: QuestionVersionSnapshot | undefined;

    const repository: QuestionLifecycleRepository = {
      findOwnership: vi.fn(async () =>
        QuestionOwnership.create('tenant-1', 'principal-1'),
      ),
      findLatest: vi.fn(async () => latest),
      findVersion: vi.fn(async () => source),
      persist: vi.fn(async (command) => {
        persisted = command.snapshot;
      }),
    };

    const service = new QuestionLifecycleApplicationService(
      repository,
      () => new Date('2026-02-01T00:00:00.000Z'),
    );

    const result = await service.restore(
      { principalId: 'principal-1', tenantId: 'tenant-1' },
      questionId.value,
      source.id.value,
    );

    expect(result.versionNumber).toBe(3);

    if (persisted === undefined) {
      throw new Error('Expected the restored snapshot to be persisted.');
    }

    const saved = persisted;

    const restoredContent = saved.content as Extract<
      QuestionVersionContent,
      { questionType: typeof QuestionType.SINGLE_CHOICE }
    >;

    const restoredAnswerKey = saved.answerKey as Extract<
      QuestionVersionAnswerKey,
      { questionType: typeof QuestionType.SINGLE_CHOICE }
    >;

    const sourceContent = source.content as Extract<
      QuestionVersionContent,
      { questionType: typeof QuestionType.SINGLE_CHOICE }
    >;

    expect(restoredContent.options[0]?.id).not.toBe(
      sourceContent.options[0]?.id,
    );

    expect(restoredAnswerKey.correctOptionId).toBe(
      restoredContent.options[0]?.id,
    );

    expect(saved.lineage.restoredFromVersion?.id.value).toBe(
      source.id.value,
    );

    expect(saved.lineage.previousVersion?.id.value).toBe(
      latest.id.value,
    );
  });
});

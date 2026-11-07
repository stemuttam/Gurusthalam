import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AnswerFormat,
  QuestionId,
  QuestionOwnership,
  QuestionType,
  QuestionVersionId,
  QuestionVersionLineage,
  QuestionVersionNumber,
  QuestionVersionReference,
  createQuestionCreatedEvent,
  createQuestionRevisedEvent,
  createQuestionRestoredEvent,
  createQuestionVersionSnapshot,
  type AnyQuestionVersionSnapshotInput,
  type QuestionVersionSnapshot,
} from '@gurusthalam/question-bank';

import { PrismaService } from '../../prisma.service.js';
import { PrismaQuestionLifecycleRepository } from './prisma-question-lifecycle.repository.js';

const databaseAvailable = Boolean(process.env.DATABASE_URL);

const suitePrefix = `phase-5-14-f-lifecycle-${randomUUID()}`;
const occurredAt = new Date('2026-02-01T00:00:00.000Z');
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

function createSnapshot(
  questionType: QuestionType,
  answerFormat: AnswerFormat,
  content: AnyQuestionVersionSnapshotInput['content'],
  answerKey: AnyQuestionVersionSnapshotInput['answerKey'],
  id: string,
  questionId: string,
  versionNumber = 1,
  previousVersion?: QuestionVersionSnapshot,
  restoredFrom?: QuestionVersionSnapshot,
): QuestionVersionSnapshot {
  const versionId = QuestionVersionId.from(id);
  const aggregateId = QuestionId.from(questionId);
  const number = QuestionVersionNumber.from(versionNumber);

  const current = QuestionVersionReference.create(
    versionId,
    aggregateId,
    number,
  );

  const previousReference =
    previousVersion === undefined
      ? null
      : QuestionVersionReference.create(
          previousVersion.id,
          previousVersion.questionId,
          previousVersion.versionNumber,
        );

  const restoredReference =
    restoredFrom === undefined
      ? null
      : QuestionVersionReference.create(
          restoredFrom.id,
          restoredFrom.questionId,
          restoredFrom.versionNumber,
        );

  return createQuestionVersionSnapshot({
    id: versionId,
    questionId: aggregateId,
    versionNumber: number,
    questionType,
    answerFormat,
    content,
    answerKey,
    lineage: QuestionVersionLineage.create(
      current,
      previousReference,
      restoredReference,
    ),
    createdAt: new Date(CREATED_AT.getTime() + versionNumber),
  } as AnyQuestionVersionSnapshotInput);
}

function createFixtures() {
  return [
    {
      name: 'SINGLE_CHOICE',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.SINGLE_CHOICE,
          AnswerFormat.SELECTED_OPTION,
          {
            questionType: 'SINGLE_CHOICE',
            prompt: { text: 'Which planet is known as the Red Planet?' },
            options: [
              { id: `${id}-mars`, text: 'Mars' },
              { id: `${id}-venus`, text: 'Venus' },
              { id: `${id}-jupiter`, text: 'Jupiter' },
            ],
          },
          {
            questionType: 'SINGLE_CHOICE',
            correctOptionId: `${id}-mars`,
          },
          id,
          questionId,
        ),
    },
    {
      name: 'MULTIPLE_CHOICE',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.MULTIPLE_CHOICE,
          AnswerFormat.SELECTED_OPTIONS,
          {
            questionType: 'MULTIPLE_CHOICE',
            prompt: { text: 'Select the prime numbers.' },
            options: [
              { id: `${id}-two`, text: '2' },
              { id: `${id}-four`, text: '4' },
              { id: `${id}-five`, text: '5' },
              { id: `${id}-seven`, text: '7' },
            ],
          },
          {
            questionType: 'MULTIPLE_CHOICE',
            correctOptionIds: [
              `${id}-two`,
              `${id}-five`,
              `${id}-seven`,
            ],
          },
          id,
          questionId,
        ),
    },
    {
      name: 'TRUE_FALSE',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.TRUE_FALSE,
          AnswerFormat.BOOLEAN,
          {
            questionType: 'TRUE_FALSE',
            prompt: { text: 'The Earth orbits the Sun.' },
          },
          {
            questionType: 'TRUE_FALSE',
            correctValue: true,
          },
          id,
          questionId,
        ),
    },
    {
      name: 'SHORT_ANSWER',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.SHORT_ANSWER,
          AnswerFormat.SHORT_TEXT,
          {
            questionType: 'SHORT_ANSWER',
            prompt: {
              text: 'Name the process by which plants make food.',
            },
          },
          {
            questionType: 'SHORT_ANSWER',
            acceptedAnswers: ['Photosynthesis', 'photosynthesis'],
          },
          id,
          questionId,
        ),
    },
    {
      name: 'LONG_ANSWER',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.LONG_ANSWER,
          AnswerFormat.LONG_TEXT,
          {
            questionType: 'LONG_ANSWER',
            prompt: { text: 'Explain the water cycle.' },
          },
          {
            questionType: 'LONG_ANSWER',
            referenceAnswer:
              'The water cycle is the continuous movement of water through evaporation, condensation and precipitation.',
          },
          id,
          questionId,
        ),
    },
    {
      name: 'NUMERIC',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.NUMERIC,
          AnswerFormat.NUMBER,
          {
            questionType: 'NUMERIC',
            prompt: { text: 'What is 12 multiplied by 8?' },
            unit: null,
          },
          {
            questionType: 'NUMERIC',
            expectedValue: 96,
          },
          id,
          questionId,
        ),
    },
    {
      name: 'MATCHING',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.MATCHING,
          AnswerFormat.MATCHING_PAIRS,
          {
            questionType: 'MATCHING',
            matchingMode: 'MANY_TO_ONE',
            prompt: {
              text: 'Match each item with its category.',
            },
            leftItems: [
              { id: `${id}-rose`, text: 'Rose' },
              { id: `${id}-mango`, text: 'Mango' },
            ],
            rightItems: [
              { id: `${id}-plant`, text: 'Plant' },
              { id: `${id}-animal`, text: 'Animal' },
            ],
          },
          {
            questionType: 'MATCHING',
            correctPairs: [
              {
                leftItemId: `${id}-rose`,
                rightItemId: `${id}-plant`,
              },
              {
                leftItemId: `${id}-mango`,
                rightItemId: `${id}-plant`,
              },
            ],
          },
          id,
          questionId,
        ),
    },
    {
      name: 'ORDERING',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.ORDERING,
          AnswerFormat.ORDERED_ITEMS,
          {
            questionType: 'ORDERING',
            prompt: {
              text: 'Arrange the stages in the correct order.',
            },
            items: [
              { id: `${id}-stage-1`, text: 'Seed' },
              { id: `${id}-stage-2`, text: 'Seedling' },
              { id: `${id}-stage-3`, text: 'Mature plant' },
            ],
          },
          {
            questionType: 'ORDERING',
            correctOrderedItemIds: [
              `${id}-stage-1`,
              `${id}-stage-2`,
              `${id}-stage-3`,
            ],
          },
          id,
          questionId,
        ),
    },
    {
      name: 'FILL_IN_THE_BLANK',
      create: (id: string, questionId: string) =>
        createSnapshot(
          QuestionType.FILL_IN_THE_BLANK,
          AnswerFormat.BLANK_RESPONSES,
          {
            questionType: 'FILL_IN_THE_BLANK',
            prompt: {
              segments: [
                {
                  kind: 'TEXT',
                  text: 'The capital of France is ',
                },
                {
                  kind: 'BLANK',
                  blankId: `${id}-capital`,
                },
                {
                  kind: 'TEXT',
                  text: ' and the capital of Japan is ',
                },
                {
                  kind: 'BLANK',
                  blankId: `${id}-japan`,
                },
                {
                  kind: 'TEXT',
                  text: '.',
                },
              ],
            },
          },
          {
            questionType: 'FILL_IN_THE_BLANK',
            blanks: [
              {
                blankId: `${id}-capital`,
                acceptedAnswers: ['Paris'],
              },
              {
                blankId: `${id}-japan`,
                acceptedAnswers: ['Tokyo'],
              },
            ],
          },
          id,
          questionId,
        ),
    },
  ] as const;
}

function createSingleChoiceSnapshot(
  idValue: string,
  questionIdValue: string,
  versionNumberValue: number,
  previous?: QuestionVersionSnapshot,
  restoredFrom?: QuestionVersionSnapshot,
): QuestionVersionSnapshot {
  const id = QuestionVersionId.from(idValue);
  const questionId = QuestionId.from(questionIdValue);
  const versionNumber = QuestionVersionNumber.from(versionNumberValue);
  const current = QuestionVersionReference.create(
    id,
    questionId,
    versionNumber,
  );

  const previousReference = previous
    ? QuestionVersionReference.create(
        previous.id,
        previous.questionId,
        previous.versionNumber,
      )
    : null;

  const restoredReference = restoredFrom
    ? QuestionVersionReference.create(
        restoredFrom.id,
        restoredFrom.questionId,
        restoredFrom.versionNumber,
      )
    : null;

  return createQuestionVersionSnapshot({
    id,
    questionId,
    versionNumber,
    questionType: QuestionType.SINGLE_CHOICE,
    answerFormat: AnswerFormat.SELECTED_OPTION,
    content: {
      questionType: 'SINGLE_CHOICE',
      prompt: {
        text: `Lifecycle question version ${versionNumberValue}`,
      },
      options: [
        { id: `${idValue}-option-a`, text: 'Option A' },
        { id: `${idValue}-option-b`, text: 'Option B' },
      ],
    },
    answerKey: {
      questionType: 'SINGLE_CHOICE',
      correctOptionId: `${idValue}-option-a`,
    },
    lineage: QuestionVersionLineage.create(
      current,
      previousReference,
      restoredReference,
    ),
    createdAt: new Date(occurredAt.getTime() + versionNumberValue),
  } as AnyQuestionVersionSnapshotInput);
}

describe.skipIf(!databaseAvailable)(
  'PrismaQuestionLifecycleRepository - PostgreSQL integration',
  () => {
    let prisma: PrismaService | undefined;

    const requirePrisma = (): PrismaService => {
      if (prisma === undefined) {
        throw new Error(
          'PostgreSQL integration database was not initialized.',
        );
      }

      return prisma;
    };

    let repository: PrismaQuestionLifecycleRepository;
    let tenantId: string;
    let creatorPrincipalId: string;
    let editorPrincipalId: string;
    let ownership: QuestionOwnership;

    beforeAll(async () => {
      const database = new PrismaService();
      prisma = database;
      await database.$connect();

      tenantId = `${suitePrefix}-tenant`;
      creatorPrincipalId = `${suitePrefix}-creator`;
      editorPrincipalId = `${suitePrefix}-editor`;

      await requirePrisma().tenant.create({
        data: {
          id: tenantId,
          slug: `${suitePrefix}-tenant`,
          name: 'Question lifecycle integration tenant',
          auth0OrganizationId: `${suitePrefix}-auth0-org`,
        },
      });

      await requirePrisma().authPrincipal.createMany({
        data: [
          { id: creatorPrincipalId },
          { id: editorPrincipalId },
        ],
      });

      await requirePrisma().principalTenantMembership.createMany({
        data: [
          { principalId: creatorPrincipalId, tenantId },
          { principalId: editorPrincipalId, tenantId },
        ],
      });

      ownership = QuestionOwnership.create(
        tenantId,
        creatorPrincipalId,
      );

      repository = new PrismaQuestionLifecycleRepository(database);
    });

    afterAll(async () => {
      if (prisma !== undefined) {
        await prisma.$disconnect();
        prisma = undefined;
      }
    });

    it.each(createFixtures())(
      'creates and hydrates the complete $name snapshot with its outbox event',
      async (fixture) => {
        const questionId = `${suitePrefix}-${fixture.name}-question`;
        const versionId = `${suitePrefix}-${fixture.name}-version`;
        const snapshot = fixture.create(versionId, questionId);

        const event = createQuestionCreatedEvent(
          snapshot.questionId,
          snapshot.id,
          snapshot.versionNumber,
          ownership,
          snapshot.createdAt,
        );

        await repository.persist({
          operation: 'CREATE',
          snapshot,
          ownership,
          event,
        });

        const [stored, question, outbox] = await Promise.all([
          repository.findLatest(tenantId, snapshot.questionId),
          requirePrisma().question.findUnique({
            where: { id: questionId },
          }),
          requirePrisma().outboxEvent.findUnique({
            where: {
              dedupeKey: `question-domain-event:${event.eventId}`,
            },
          }),
        ]);

        expect(stored).not.toBeNull();
        expect(stored?.questionType).toBe(snapshot.questionType);
        expect(stored?.answerFormat).toBe(snapshot.answerFormat);

        expect(question).toMatchObject({
          tenantId,
          createdByPrincipalId: creatorPrincipalId,
        });

        expect(outbox).toMatchObject({
          eventType: 'QuestionCreated',
          aggregateType: 'Question',
          aggregateId: questionId,
          status: 'PENDING',
        });

        expect(outbox?.payload).toMatchObject({
          eventName: 'QuestionCreated',
          payload: {
            questionId,
            questionVersionId: versionId,
            tenantId,
          },
        });
      },
    );

    it(
      'supports revise and restore as new immutable versions while preserving creator ownership',
      async () => {
        const questionIdValue = `${suitePrefix}-lineage-question`;

        const first = createSingleChoiceSnapshot(
          `${suitePrefix}-lineage-v1`,
          questionIdValue,
          1,
        );

        const createdEvent = createQuestionCreatedEvent(
          first.questionId,
          first.id,
          first.versionNumber,
          ownership,
          first.createdAt,
        );

        await repository.persist({
          operation: 'CREATE',
          snapshot: first,
          ownership,
          event: createdEvent,
        });

        const editorOwnership = QuestionOwnership.create(
          tenantId,
          editorPrincipalId,
        );

        const second = createSingleChoiceSnapshot(
          `${suitePrefix}-lineage-v2`,
          questionIdValue,
          2,
          first,
        );

        const revisedEvent = createQuestionRevisedEvent(
          second.questionId,
          second.id,
          second.versionNumber,
          first.id,
          editorOwnership,
          editorPrincipalId,
          second.createdAt,
        );

        await repository.persist({
          operation: 'APPEND',
          snapshot: second,
          ownership: editorOwnership,
          expectedPreviousVersionId: first.id,
          event: revisedEvent,
        });

        const third = createSingleChoiceSnapshot(
          `${suitePrefix}-lineage-v3`,
          questionIdValue,
          3,
          second,
          first,
        );

        const restoredEvent = createQuestionRestoredEvent(
          third.questionId,
          third.id,
          third.versionNumber,
          second.id,
          first.id,
          editorOwnership,
          editorPrincipalId,
          third.createdAt,
        );

        await repository.persist({
          operation: 'APPEND',
          snapshot: third,
          ownership: editorOwnership,
          expectedPreviousVersionId: second.id,
          event: restoredEvent,
        });

        const [latest, question, versions, outboxEvents] =
          await Promise.all([
            repository.findLatest(tenantId, first.questionId),
            requirePrisma().question.findUnique({
              where: { id: questionIdValue },
            }),
            requirePrisma().questionVersion.findMany({
              where: { questionId: questionIdValue },
              orderBy: { versionNumber: 'asc' },
            }),
            requirePrisma().outboxEvent.findMany({
              where: { aggregateId: questionIdValue },
              orderBy: { createdAt: 'asc' },
            }),
          ]);

        expect(latest?.id.value).toBe(third.id.value);
        expect(latest?.lineage.previousVersion?.id.value).toBe(
          second.id.value,
        );
        expect(latest?.lineage.restoredFromVersion?.id.value).toBe(
          first.id.value,
        );

        expect(versions.map((item) => item.versionNumber)).toEqual([
          1n,
          2n,
          3n,
        ]);

        expect(question?.createdByPrincipalId).toBe(
          creatorPrincipalId,
        );

        expect(outboxEvents.map((item) => item.eventType)).toEqual([
          'QuestionCreated',
          'QuestionRevised',
          'QuestionRestored',
        ]);
      },
    );

    it(
      'does not expose a tenant-owned Question through another tenant context',
      async () => {
        const questionIdValue = `${suitePrefix}-tenant-boundary-question`;

        const snapshot = createSingleChoiceSnapshot(
          `${suitePrefix}-tenant-boundary-v1`,
          questionIdValue,
          1,
        );

        const event = createQuestionCreatedEvent(
          snapshot.questionId,
          snapshot.id,
          snapshot.versionNumber,
          ownership,
          snapshot.createdAt,
        );

        await repository.persist({
          operation: 'CREATE',
          snapshot,
          ownership,
          event,
        });

        await expect(
          repository.findLatest(
            `${suitePrefix}-different-tenant`,
            snapshot.questionId,
          ),
        ).resolves.toBeNull();

        await expect(
          repository.findVersion(
            `${suitePrefix}-different-tenant`,
            snapshot.questionId,
            snapshot.id,
          ),
        ).resolves.toBeNull();
      },
    );

    it(
      'rejects a stale append after another version has become current',
      async () => {
        const questionIdValue = `${suitePrefix}-stale-append-question`;

        const first = createSingleChoiceSnapshot(
          `${suitePrefix}-stale-v1`,
          questionIdValue,
          1,
        );

        const createEvent = createQuestionCreatedEvent(
          first.questionId,
          first.id,
          first.versionNumber,
          ownership,
          first.createdAt,
        );

        await repository.persist({
          operation: 'CREATE',
          snapshot: first,
          ownership,
          event: createEvent,
        });

        const second = createSingleChoiceSnapshot(
          `${suitePrefix}-stale-v2`,
          questionIdValue,
          2,
          first,
        );

        const secondEvent = createQuestionRevisedEvent(
          second.questionId,
          second.id,
          second.versionNumber,
          first.id,
          ownership,
          creatorPrincipalId,
          second.createdAt,
        );

        await repository.persist({
          operation: 'APPEND',
          snapshot: second,
          ownership,
          expectedPreviousVersionId: first.id,
          event: secondEvent,
        });

        const stale = createSingleChoiceSnapshot(
          `${suitePrefix}-stale-v2-retry`,
          questionIdValue,
          2,
          first,
        );

        const staleEvent = createQuestionRevisedEvent(
          stale.questionId,
          stale.id,
          stale.versionNumber,
          first.id,
          ownership,
          creatorPrincipalId,
          stale.createdAt,
        );

        await expect(
          repository.persist({
            operation: 'APPEND',
            snapshot: stale,
            ownership,
            expectedPreviousVersionId: first.id,
            event: staleEvent,
          }),
        ).rejects.toThrow();

        const versions =
          await requirePrisma().questionVersion.findMany({
            where: { questionId: questionIdValue },
          });

        expect(versions).toHaveLength(2);
      },
    );
  },
);
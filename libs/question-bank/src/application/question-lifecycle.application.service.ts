
import {
  createQuestionCreatedEvent,
  createQuestionRestoredEvent,
  createQuestionRevisedEvent,
  QuestionId,
  QuestionVersionId,
  QuestionVersionLineage,
  QuestionVersionNumber,
  QuestionVersionReference,
  createQuestionVersionSnapshot,
  QuestionOwnership,
  QuestionType,
  type AnyQuestionVersionSnapshotInput,
  type QuestionLifecycleRepository,
  type QuestionVersionSnapshot,
  type QuestionVersionContent,
  type QuestionVersionAnswerKey,
} from '../domain/index.js';
import type { QuestionVersionDraft } from './question-version-draft.js';

export interface QuestionActor {
  /** Must be mapped from the trusted authenticated-principal boundary. */
  readonly principalId: string;
  readonly tenantId: string;
}

export interface CreateQuestionResult {
  readonly questionId: string;
  readonly versionId: string;
  readonly versionNumber: number;
}

export interface AppendQuestionResult extends CreateQuestionResult {
  readonly previousVersionId: string;
  readonly restoredFromVersionId?: string;
}

/**
 * Application orchestration for Question create/revise/restore.
 *
 * The creator and the actor are deliberately separate:
 * - ownership.createdByPrincipalId never changes after Question creation;
 * - actorPrincipalId identifies the principal performing each write.
 *
 * The API adapter supplies the actor from the trusted authenticated-principal
 * boundary. Tenant and actor identifiers are never accepted from the draft.
 */
export class QuestionLifecycleApplicationService {
  constructor(
    private readonly repository: QuestionLifecycleRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async create(
    actor: QuestionActor,
    draft: QuestionVersionDraft,
  ): Promise<CreateQuestionResult> {
    const validatedActor = this.validateActor(actor);
    const ownership = QuestionOwnership.create(
      validatedActor.tenantId,
      validatedActor.principalId,
    );

    const questionId = QuestionId.generate();
    const versionId = QuestionVersionId.generate();
    const versionNumber = QuestionVersionNumber.initial();
    const now = this.validNow();

    const current = QuestionVersionReference.create(
      versionId,
      questionId,
      versionNumber,
    );

    const snapshot = createQuestionVersionSnapshot({
      ...draft,
      id: versionId,
      questionId,
      versionNumber,
      lineage: QuestionVersionLineage.create(current, null, null),
      createdAt: now,
    } as AnyQuestionVersionSnapshotInput);

    const event = createQuestionCreatedEvent(
      questionId,
      versionId,
      versionNumber,
      ownership,
      now,
    );

    await this.repository.persist({
      operation: 'CREATE',
      snapshot,
      ownership,
      actorPrincipalId: validatedActor.principalId,
      event,
    });

    return Object.freeze({
      questionId: questionId.value,
      versionId: versionId.value,
      versionNumber: versionNumber.value,
    });
  }

  async revise(
    actor: QuestionActor,
    questionIdValue: string,
    draft: QuestionVersionDraft,
  ): Promise<AppendQuestionResult> {
    const validatedActor = this.validateActor(actor);
    const questionId = QuestionId.from(questionIdValue);

    // Retrieve the immutable creator ownership. Never replace it with the
    // editor's identity merely because the editor is performing this write.
    const ownership = await this.repository.findOwnership(
      validatedActor.tenantId,
      questionId,
    );

    if (ownership === null) {
      throw new QuestionLifecycleNotFoundError(
        'The Question was not found in the authenticated tenant.',
      );
    }

    const latest = await this.requireLatest(ownership.tenantId, questionId);
    const versionNumber = latest.versionNumber.next();
    const versionId = QuestionVersionId.generate();
    const now = this.validNow();

    const current = QuestionVersionReference.create(
      versionId,
      questionId,
      versionNumber,
    );

    const previous = this.toReference(latest);

    const snapshot = createQuestionVersionSnapshot({
      ...draft,
      id: versionId,
      questionId,
      versionNumber,
      lineage: QuestionVersionLineage.create(current, previous, null),
      createdAt: now,
    } as AnyQuestionVersionSnapshotInput);

    const event = createQuestionRevisedEvent(
      questionId,
      versionId,
      versionNumber,
      latest.id,
      ownership,
      validatedActor.principalId,
      now,
    );

    await this.repository.persist({
      operation: 'APPEND',
      snapshot,
      ownership,
      actorPrincipalId: validatedActor.principalId,
      expectedPreviousVersionId: latest.id,
      event,
    });

    return Object.freeze({
      questionId: questionId.value,
      versionId: versionId.value,
      versionNumber: versionNumber.value,
      previousVersionId: latest.id.value,
    });
  }

  async restore(
    actor: QuestionActor,
    questionIdValue: string,
    sourceVersionIdValue: string,
  ): Promise<AppendQuestionResult> {
    const validatedActor = this.validateActor(actor);
    const questionId = QuestionId.from(questionIdValue);

    // Restore uses the same immutable ownership rule as revise.
    const ownership = await this.repository.findOwnership(
      validatedActor.tenantId,
      questionId,
    );

    if (ownership === null) {
      throw new QuestionLifecycleNotFoundError(
        'The Question was not found in the authenticated tenant.',
      );
    }

    const sourceVersionId = QuestionVersionId.from(sourceVersionIdValue);

    const [latest, source] = await Promise.all([
      this.requireLatest(ownership.tenantId, questionId),
      this.repository.findVersion(
        ownership.tenantId,
        questionId,
        sourceVersionId,
      ),
    ]);

    if (source === null) {
      throw new QuestionLifecycleNotFoundError(
        'The requested historical version was not found for this tenant.',
      );
    }

    const versionNumber = latest.versionNumber.next();
    const versionId = QuestionVersionId.generate();
    const now = this.validNow();

    const current = QuestionVersionReference.create(
      versionId,
      questionId,
      versionNumber,
    );

    const restored = cloneVersionScopedIdentities(source);

    const snapshot = createQuestionVersionSnapshot({
      id: versionId,
      questionId,
      versionNumber,
      questionType: source.questionType,
      answerFormat: source.answerFormat,
      content: restored.content,
      answerKey: restored.answerKey,
      lineage: QuestionVersionLineage.create(
        current,
        this.toReference(latest),
        this.toReference(source),
      ),
      createdAt: now,
    } as AnyQuestionVersionSnapshotInput);

    const event = createQuestionRestoredEvent(
      questionId,
      versionId,
      versionNumber,
      latest.id,
      source.id,
      ownership,
      validatedActor.principalId,
      now,
    );

    await this.repository.persist({
      operation: 'APPEND',
      snapshot,
      ownership,
      actorPrincipalId: validatedActor.principalId,
      expectedPreviousVersionId: latest.id,
      event,
    });

    return Object.freeze({
      questionId: questionId.value,
      versionId: versionId.value,
      versionNumber: versionNumber.value,
      previousVersionId: latest.id.value,
      restoredFromVersionId: source.id.value,
    });
  }

  private async requireLatest(
    tenantId: string,
    questionId: QuestionId,
  ): Promise<QuestionVersionSnapshot> {
    const latest = await this.repository.findLatest(tenantId, questionId);

    if (latest === null) {
      throw new QuestionLifecycleNotFoundError(
        'The Question was not found in the authenticated tenant.',
      );
    }

    return latest;
  }

  private validateActor(actor: QuestionActor): QuestionActor {
    if (
      actor === null ||
      typeof actor !== 'object' ||
      typeof actor.principalId !== 'string' ||
      actor.principalId.length === 0 ||
      actor.principalId.trim() !== actor.principalId ||
      typeof actor.tenantId !== 'string' ||
      actor.tenantId.length === 0 ||
      actor.tenantId.trim() !== actor.tenantId
    ) {
      throw new QuestionLifecycleAuthenticationError(
        'A valid authenticated principal and tenant are required.',
      );
    }

    return Object.freeze({
      principalId: actor.principalId,
      tenantId: actor.tenantId,
    });
  }

  private toReference(snapshot: QuestionVersionSnapshot) {
    return QuestionVersionReference.create(
      snapshot.id,
      snapshot.questionId,
      snapshot.versionNumber,
    );
  }

  private validNow(): Date {
    const now = this.clock();

    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      throw new TypeError(
        'Question lifecycle clock returned an invalid Date.',
      );
    }

    return new Date(now.getTime());
  }
}

/**
 * A restored version is a new immutable snapshot.
 *
 * All version-scoped child identities are regenerated, and every answer-key
 * reference to those identities is remapped to the new identity.
 */
function cloneVersionScopedIdentities(
  source: QuestionVersionSnapshot,
): {
  readonly content: QuestionVersionContent;
  readonly answerKey: QuestionVersionAnswerKey;
} {
  const newId = (): string => QuestionVersionId.generate().value;

  switch (source.questionType) {
    case QuestionType.SINGLE_CHOICE: {
      const content = source.content as Extract<
        QuestionVersionContent,
        { questionType: typeof QuestionType.SINGLE_CHOICE }
      >;
      const answerKey = source.answerKey as Extract<
        QuestionVersionAnswerKey,
        { questionType: typeof QuestionType.SINGLE_CHOICE }
      >;
      const ids = new Map<string, string>();
      const options = content.options.map((item) => {
        const id = newId();
        ids.set(item.id, id);
        return { ...item, id };
      });

      return {
        content: {
          ...content,
          questionType: QuestionType.SINGLE_CHOICE,
          options,
        },
        answerKey: {
          ...answerKey,
          questionType: QuestionType.SINGLE_CHOICE,
          correctOptionId: requireMappedId(
            ids,
            answerKey.correctOptionId,
            'single-choice correct option',
          ),
        },
      };
    }

    case QuestionType.MULTIPLE_CHOICE: {
      const content = source.content as Extract<
        QuestionVersionContent,
        { questionType: typeof QuestionType.MULTIPLE_CHOICE }
      >;
      const answerKey = source.answerKey as Extract<
        QuestionVersionAnswerKey,
        { questionType: typeof QuestionType.MULTIPLE_CHOICE }
      >;
      const ids = new Map<string, string>();
      const options = content.options.map((item) => {
        const id = newId();
        ids.set(item.id, id);
        return { ...item, id };
      });

      return {
        content: {
          ...content,
          questionType: QuestionType.MULTIPLE_CHOICE,
          options,
        },
        answerKey: {
          ...answerKey,
          questionType: QuestionType.MULTIPLE_CHOICE,
          correctOptionIds: answerKey.correctOptionIds.map((id) =>
            requireMappedId(ids, id, 'multiple-choice correct option'),
          ),
        },
      };
    }

    case QuestionType.MATCHING: {
      const content = source.content as Extract<
        QuestionVersionContent,
        { questionType: typeof QuestionType.MATCHING }
      >;
      const answerKey = source.answerKey as Extract<
        QuestionVersionAnswerKey,
        { questionType: typeof QuestionType.MATCHING }
      >;
      const leftIds = new Map<string, string>();
      const rightIds = new Map<string, string>();

      const leftItems = content.leftItems.map((item) => {
        const id = newId();
        leftIds.set(item.id, id);
        return { ...item, id };
      });

      const rightItems = content.rightItems.map((item) => {
        const id = newId();
        rightIds.set(item.id, id);
        return { ...item, id };
      });

      const correctPairs = answerKey.correctPairs.map((pair) => ({
        leftItemId: requireMappedId(
          leftIds,
          pair.leftItemId,
          'matching left item',
        ),
        rightItemId: requireMappedId(
          rightIds,
          pair.rightItemId,
          'matching right item',
        ),
      }));

      return {
        content: {
          ...content,
          questionType: QuestionType.MATCHING,
          leftItems,
          rightItems,
        },
        answerKey: {
          ...answerKey,
          questionType: QuestionType.MATCHING,
          correctPairs,
        },
      };
    }

    case QuestionType.ORDERING: {
      const content = source.content as Extract<
        QuestionVersionContent,
        { questionType: typeof QuestionType.ORDERING }
      >;
      const answerKey = source.answerKey as Extract<
        QuestionVersionAnswerKey,
        { questionType: typeof QuestionType.ORDERING }
      >;
      const ids = new Map<string, string>();
      const items = content.items.map((item) => {
        const id = newId();
        ids.set(item.id, id);
        return { ...item, id };
      });

      return {
        content: {
          ...content,
          questionType: QuestionType.ORDERING,
          items,
        },
        answerKey: {
          ...answerKey,
          questionType: QuestionType.ORDERING,
          correctOrderedItemIds: answerKey.correctOrderedItemIds.map((id) =>
            requireMappedId(ids, id, 'ordering item'),
          ),
        },
      };
    }

    case QuestionType.FILL_IN_THE_BLANK: {
      const content = source.content as Extract<
        QuestionVersionContent,
        { questionType: typeof QuestionType.FILL_IN_THE_BLANK }
      >;
      const answerKey = source.answerKey as Extract<
        QuestionVersionAnswerKey,
        { questionType: typeof QuestionType.FILL_IN_THE_BLANK }
      >;
      const ids = new Map<string, string>();

      const segments = content.prompt.segments.map((segment) => {
        if (segment.kind === 'TEXT') {
          return { ...segment };
        }

        const blankId = newId();
        ids.set(segment.blankId, blankId);

        return {
          ...segment,
          kind: 'BLANK' as const,
          blankId,
        };
      });

      const blanks = answerKey.blanks.map((blank) => ({
        blankId: requireMappedId(ids, blank.blankId, 'fill-in-the-blank'),
        acceptedAnswers: [...blank.acceptedAnswers],
      }));

      return {
        content: {
          ...content,
          questionType: QuestionType.FILL_IN_THE_BLANK,
          prompt: { ...content.prompt, segments },
        },
        answerKey: {
          ...answerKey,
          questionType: QuestionType.FILL_IN_THE_BLANK,
          blanks,
        },
      };
    }

    case QuestionType.TRUE_FALSE:
    case QuestionType.SHORT_ANSWER:
    case QuestionType.LONG_ANSWER:
    case QuestionType.NUMERIC:
      return {
        content: source.content,
        answerKey: source.answerKey,
      };

    default: {
      const exhaustiveCheck: never = source.questionType;
      throw new TypeError(
        `Unsupported Question type during restore: ${String(exhaustiveCheck)}`,
      );
    }
  }
}

function requireMappedId(
  ids: ReadonlyMap<string, string>,
  originalId: string,
  referenceDescription: string,
): string {
  const mappedId = ids.get(originalId);

  if (mappedId === undefined) {
    throw new TypeError(
      `Cannot restore Question: missing identity mapping for ${referenceDescription}.`,
    );
  }

  return mappedId;
}

export class QuestionLifecycleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionLifecycleNotFoundError';
  }
}

export class QuestionLifecycleAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionLifecycleAuthenticationError';
  }
}

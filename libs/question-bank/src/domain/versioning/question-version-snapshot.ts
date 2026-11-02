import type { AnswerFormat } from '../answer-formats/answer-format.js';
import { isAnswerFormat } from '../answer-formats/answer-format.js';
import { isSupportedAnswerFormat } from '../compatibility/question-answer-compatibility.js';
import type {
  QuestionVersionAnswerKey,
  QuestionVersionAnswerKeyFor,
} from '../content/question-version-answer-key.js';
import type {
  QuestionVersionContent,
  QuestionVersionContentFor,
} from '../content/question-version-content.js';
import { QuestionId } from '../identifiers/question-id.js';
import { QuestionVersionId } from '../identifiers/question-version-id.js';
import { QuestionVersionNumber } from '../identifiers/question-version-number.js';
import {
  isQuestionType,
  QuestionType,
} from '../question-types/question-type.js';
import type { QuestionType as QuestionTypeValue } from '../question-types/question-type.js';
import { QuestionVersionLineage } from './question-version-lineage.js';

export interface QuestionVersionSnapshot<
  T extends QuestionTypeValue = QuestionTypeValue,
> {
  readonly id: QuestionVersionId;
  readonly questionId: QuestionId;
  readonly versionNumber: QuestionVersionNumber;
  readonly questionType: T;
  readonly answerFormat: AnswerFormat;
  readonly content: QuestionVersionContentFor<T>;
  readonly answerKey: QuestionVersionAnswerKeyFor<T>;
  readonly lineage: QuestionVersionLineage;
  readonly createdAt: Date;
}

export interface QuestionVersionSnapshotInput<T extends QuestionTypeValue> {
  readonly id: QuestionVersionId;
  readonly questionId: QuestionId;
  readonly versionNumber: QuestionVersionNumber;
  readonly questionType: T;
  readonly answerFormat: AnswerFormat;
  readonly content: QuestionVersionContentFor<T>;
  readonly answerKey: QuestionVersionAnswerKeyFor<T>;
  readonly lineage: QuestionVersionLineage;
  readonly createdAt: Date;
}

export type AnyQuestionVersionSnapshotInput = {
  [T in QuestionTypeValue]: QuestionVersionSnapshotInput<T>;
}[QuestionTypeValue];

type UnknownRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function assertRecord(
  value: unknown,
  field: string,
): asserts value is UnknownRecord {
  if (!isPlainRecord(value)) {
    throw new TypeError(`${field} must be a plain object.`);
  }
}

function assertArray(
  value: unknown,
  field: string,
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array.`);
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string.`);
  }
}

function assertIdentifier(
  value: unknown,
  field: string,
): asserts value is string {
  assertString(value, field);

  if (
    value.length === 0 ||
    value.trim().length === 0 ||
    value.trim() !== value
  ) {
    throw new TypeError(
      `${field} must be a non-empty string without surrounding whitespace.`,
    );
  }
}

function assertUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${field} must be unique.`);
  }
}

function assertReferencesExist(
  references: readonly string[],
  availableIds: readonly string[],
  field: string,
): void {
  const available = new Set(availableIds);

  for (const reference of references) {
    if (!available.has(reference)) {
      throw new TypeError(`${field} references an unknown ID: ${reference}.`);
    }
  }
}

function clonePrompt(
  value: unknown,
  field: string,
): Readonly<{ text: string }> {
  assertRecord(value, field);
  assertString(value.text, `${field}.text`);

  return Object.freeze({
    text: value.text,
  });
}

function cloneItems(
  value: unknown,
  field: string,
): readonly Readonly<{ id: string; text: string }>[] {
  assertArray(value, field);

  const result = value.map((item, index) => {
    const itemField = `${field}[${index}]`;

    assertRecord(item, itemField);
    assertIdentifier(item.id, `${itemField}.id`);
    assertString(item.text, `${itemField}.text`);

    return Object.freeze({
      id: item.id,
      text: item.text,
    });
  });

  assertUnique(
    result.map((item) => item.id),
    `${field} IDs`,
  );

  return Object.freeze(result);
}

function cloneContent(
  questionType: QuestionTypeValue,
  value: unknown,
): QuestionVersionContent {
  assertRecord(value, 'content');

  if (value.questionType !== questionType) {
    throw new TypeError(
      'Content questionType must match the snapshot questionType.',
    );
  }

  switch (questionType) {
    case QuestionType.SINGLE_CHOICE:
    case QuestionType.MULTIPLE_CHOICE:
      return Object.freeze({
        questionType,
        prompt: clonePrompt(value.prompt, 'content.prompt'),
        options: cloneItems(value.options, 'content.options'),
      }) as QuestionVersionContent;

    case QuestionType.TRUE_FALSE:
    case QuestionType.SHORT_ANSWER:
    case QuestionType.LONG_ANSWER:
      return Object.freeze({
        questionType,
        prompt: clonePrompt(value.prompt, 'content.prompt'),
      }) as QuestionVersionContent;

    case QuestionType.NUMERIC: {
      const prompt = clonePrompt(value.prompt, 'content.prompt');

      if (value.unit !== null) {
        assertString(value.unit, 'content.unit');
      }

      return Object.freeze({
        questionType,
        prompt,
        unit: value.unit,
      }) as QuestionVersionContent;
    }

    case QuestionType.MATCHING:
      return Object.freeze({
        questionType,
        prompt: clonePrompt(value.prompt, 'content.prompt'),
        leftItems: cloneItems(value.leftItems, 'content.leftItems'),
        rightItems: cloneItems(value.rightItems, 'content.rightItems'),
      }) as QuestionVersionContent;

    case QuestionType.ORDERING:
      return Object.freeze({
        questionType,
        prompt: clonePrompt(value.prompt, 'content.prompt'),
        items: cloneItems(value.items, 'content.items'),
      }) as QuestionVersionContent;

    case QuestionType.FILL_IN_THE_BLANK: {
      assertRecord(value.prompt, 'content.prompt');
      assertArray(value.prompt.segments, 'content.prompt.segments');

      const segments = value.prompt.segments.map((segment, index) => {
        const field = `content.prompt.segments[${index}]`;

        assertRecord(segment, field);

        if (segment.kind === 'TEXT') {
          assertString(segment.text, `${field}.text`);

          return Object.freeze({
            kind: 'TEXT' as const,
            text: segment.text,
          });
        }

        if (segment.kind === 'BLANK') {
          assertIdentifier(segment.blankId, `${field}.blankId`);

          return Object.freeze({
            kind: 'BLANK' as const,
            blankId: segment.blankId,
          });
        }

        throw new TypeError(`${field}.kind must be TEXT or BLANK.`);
      });

      const blankIds = segments
        .filter((segment) => segment.kind === 'BLANK')
        .map((segment) => (segment.kind === 'BLANK' ? segment.blankId : ''));

      assertUnique(blankIds, 'content blank IDs');

      return Object.freeze({
        questionType,
        prompt: Object.freeze({
          segments: Object.freeze(segments),
        }),
      }) as QuestionVersionContent;
    }
  }
}

function cloneAnswerKey(
  questionType: QuestionTypeValue,
  value: unknown,
): QuestionVersionAnswerKey {
  assertRecord(value, 'answerKey');

  if (value.questionType !== questionType) {
    throw new TypeError(
      'Answer key questionType must match the snapshot questionType.',
    );
  }

  switch (questionType) {
    case QuestionType.SINGLE_CHOICE:
      assertIdentifier(value.correctOptionId, 'answerKey.correctOptionId');

      return Object.freeze({
        questionType,
        correctOptionId: value.correctOptionId,
      }) as QuestionVersionAnswerKey;

    case QuestionType.MULTIPLE_CHOICE: {
      assertArray(value.correctOptionIds, 'answerKey.correctOptionIds');

      const ids = value.correctOptionIds.map((id, index) => {
        assertIdentifier(id, `answerKey.correctOptionIds[${index}]`);
        return id;
      });

      assertUnique(ids, 'answerKey.correctOptionIds');

      return Object.freeze({
        questionType,
        correctOptionIds: Object.freeze(ids),
      }) as QuestionVersionAnswerKey;
    }

    case QuestionType.TRUE_FALSE:
      if (typeof value.correctValue !== 'boolean') {
        throw new TypeError('answerKey.correctValue must be a boolean.');
      }

      return Object.freeze({
        questionType,
        correctValue: value.correctValue,
      }) as QuestionVersionAnswerKey;

    case QuestionType.SHORT_ANSWER: {
      assertArray(value.acceptedAnswers, 'answerKey.acceptedAnswers');

      const answers = value.acceptedAnswers.map((answer, index) => {
        assertString(answer, `answerKey.acceptedAnswers[${index}]`);
        return answer;
      });

      return Object.freeze({
        questionType,
        acceptedAnswers: Object.freeze(answers),
      }) as QuestionVersionAnswerKey;
    }

    case QuestionType.LONG_ANSWER:
      assertString(value.referenceAnswer, 'answerKey.referenceAnswer');

      return Object.freeze({
        questionType,
        referenceAnswer: value.referenceAnswer,
      }) as QuestionVersionAnswerKey;

    case QuestionType.NUMERIC:
      if (
        typeof value.expectedValue !== 'number' ||
        !Number.isFinite(value.expectedValue)
      ) {
        throw new TypeError('answerKey.expectedValue must be a finite number.');
      }

      return Object.freeze({
        questionType,
        expectedValue: value.expectedValue,
      }) as QuestionVersionAnswerKey;

    case QuestionType.MATCHING: {
      assertArray(value.correctPairs, 'answerKey.correctPairs');

      const pairs = value.correctPairs.map((pair, index) => {
        const field = `answerKey.correctPairs[${index}]`;

        assertRecord(pair, field);
        assertIdentifier(pair.leftItemId, `${field}.leftItemId`);
        assertIdentifier(pair.rightItemId, `${field}.rightItemId`);

        return Object.freeze({
          leftItemId: pair.leftItemId,
          rightItemId: pair.rightItemId,
        });
      });

      return Object.freeze({
        questionType,
        correctPairs: Object.freeze(pairs),
      }) as QuestionVersionAnswerKey;
    }

    case QuestionType.ORDERING: {
      assertArray(
        value.correctOrderedItemIds,
        'answerKey.correctOrderedItemIds',
      );

      const ids = value.correctOrderedItemIds.map((id, index) => {
        assertIdentifier(id, `answerKey.correctOrderedItemIds[${index}]`);
        return id;
      });

      assertUnique(ids, 'answerKey.correctOrderedItemIds');

      return Object.freeze({
        questionType,
        correctOrderedItemIds: Object.freeze(ids),
      }) as QuestionVersionAnswerKey;
    }

    case QuestionType.FILL_IN_THE_BLANK: {
      assertArray(value.blanks, 'answerKey.blanks');

      const blanks = value.blanks.map((blank, index) => {
        const field = `answerKey.blanks[${index}]`;

        assertRecord(blank, field);
        assertIdentifier(blank.blankId, `${field}.blankId`);
        assertArray(blank.acceptedAnswers, `${field}.acceptedAnswers`);

        const answers = blank.acceptedAnswers.map((answer, answerIndex) => {
          assertString(answer, `${field}.acceptedAnswers[${answerIndex}]`);
          return answer;
        });

        return Object.freeze({
          blankId: blank.blankId,
          acceptedAnswers: Object.freeze(answers),
        });
      });

      assertUnique(
        blanks.map((blank) => blank.blankId),
        'answerKey blank IDs',
      );

      return Object.freeze({
        questionType,
        blanks: Object.freeze(blanks),
      }) as QuestionVersionAnswerKey;
    }
  }
}

function assertAnswerKeyReferences(
  questionType: QuestionTypeValue,
  content: QuestionVersionContent,
  answerKey: QuestionVersionAnswerKey,
): void {
  const contentRecord = content as unknown as UnknownRecord;
  const keyRecord = answerKey as unknown as UnknownRecord;

  switch (questionType) {
    case QuestionType.SINGLE_CHOICE: {
      const options = contentRecord.options as readonly {
        id: string;
      }[];

      const correctOptionId = keyRecord.correctOptionId as string;

      assertReferencesExist(
        [correctOptionId],
        options.map((option) => option.id),
        'answerKey.correctOptionId',
      );
      return;
    }

    case QuestionType.MULTIPLE_CHOICE: {
      const options = contentRecord.options as readonly {
        id: string;
      }[];

      const correctOptionIds = keyRecord.correctOptionIds as readonly string[];

      assertReferencesExist(
        correctOptionIds,
        options.map((option) => option.id),
        'answerKey.correctOptionIds',
      );
      return;
    }

    case QuestionType.MATCHING: {
      const leftItems = contentRecord.leftItems as readonly {
        id: string;
      }[];

      const rightItems = contentRecord.rightItems as readonly {
        id: string;
      }[];

      const pairs = keyRecord.correctPairs as readonly {
        leftItemId: string;
        rightItemId: string;
      }[];

      assertReferencesExist(
        pairs.map((pair) => pair.leftItemId),
        leftItems.map((item) => item.id),
        'answerKey.correctPairs.leftItemId',
      );

      assertReferencesExist(
        pairs.map((pair) => pair.rightItemId),
        rightItems.map((item) => item.id),
        'answerKey.correctPairs.rightItemId',
      );
      return;
    }

    case QuestionType.ORDERING: {
      const items = contentRecord.items as readonly {
        id: string;
      }[];

      const orderedIds = keyRecord.correctOrderedItemIds as readonly string[];

      if (
        orderedIds.length !== items.length ||
        items.some((item) => !orderedIds.includes(item.id))
      ) {
        throw new TypeError(
          'answerKey.correctOrderedItemIds must contain every content item exactly once.',
        );
      }
      return;
    }

    case QuestionType.FILL_IN_THE_BLANK: {
      const prompt = contentRecord.prompt as UnknownRecord;
      const segments = prompt.segments as readonly UnknownRecord[];

      const contentBlankIds = segments
        .filter((segment) => segment.kind === 'BLANK')
        .map((segment) => segment.blankId as string);

      const blanks = keyRecord.blanks as readonly {
        blankId: string;
      }[];

      const answerBlankIds = blanks.map((blank) => blank.blankId);

      if (
        contentBlankIds.length !== answerBlankIds.length ||
        contentBlankIds.some((id) => !answerBlankIds.includes(id))
      ) {
        throw new TypeError(
          'answerKey.blanks must correspond to every content blank exactly once.',
        );
      }
      return;
    }

    case QuestionType.TRUE_FALSE:
    case QuestionType.SHORT_ANSWER:
    case QuestionType.LONG_ANSWER:
    case QuestionType.NUMERIC:
      return;
  }
}

/**
 * Creates an immutable, version-bound Question snapshot.
 *
 * The factory validates:
 * - Question and Question Version identity.
 * - Version lineage ownership.
 * - Question type and answer-format compatibility.
 * - Content and answer-key discriminators.
 * - Type-specific answer-key references.
 * - Runtime content and answer-key structure.
 *
 * Content and answer-key values are defensively copied and frozen.
 * The creation date is exposed through a defensive copy.
 *
 * @throws TypeError when an invariant is violated.
 */
export function createQuestionVersionSnapshot(
  input: AnyQuestionVersionSnapshotInput,
): QuestionVersionSnapshot {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Snapshot input must be an object.');
  }

  if (!(input.id instanceof QuestionVersionId)) {
    throw new TypeError('Snapshot id must be a QuestionVersionId.');
  }

  if (!(input.questionId instanceof QuestionId)) {
    throw new TypeError('Snapshot questionId must be a QuestionId.');
  }

  if (!(input.versionNumber instanceof QuestionVersionNumber)) {
    throw new TypeError(
      'Snapshot versionNumber must be a QuestionVersionNumber.',
    );
  }

  if (!(input.lineage instanceof QuestionVersionLineage)) {
    throw new TypeError('Snapshot lineage must be a QuestionVersionLineage.');
  }

  if (!isQuestionType(input.questionType)) {
    throw new TypeError('Snapshot questionType is not supported.');
  }

  if (!isAnswerFormat(input.answerFormat)) {
    throw new TypeError('Snapshot answerFormat is not supported.');
  }

  if (!isSupportedAnswerFormat(input.questionType, input.answerFormat)) {
    throw new TypeError(
      'Snapshot answerFormat is not compatible with its questionType.',
    );
  }

  const current = input.lineage.currentVersion;

  if (
    !current.id.equals(input.id) ||
    !current.questionId.equals(input.questionId) ||
    !current.versionNumber.equals(input.versionNumber)
  ) {
    throw new TypeError(
      'Snapshot identity must match the current version in its lineage.',
    );
  }

  if (
    !(input.createdAt instanceof Date) ||
    !Number.isFinite(input.createdAt.getTime())
  ) {
    throw new TypeError('Snapshot createdAt must be a valid Date.');
  }

  const content = cloneContent(input.questionType, input.content);

  const answerKey = cloneAnswerKey(input.questionType, input.answerKey);

  assertAnswerKeyReferences(input.questionType, content, answerKey);

  const createdAtEpochMilliseconds = input.createdAt.getTime();

  const snapshot: QuestionVersionSnapshot = {
    id: input.id,
    questionId: input.questionId,
    versionNumber: input.versionNumber,
    questionType: input.questionType,
    answerFormat: input.answerFormat,
    content,
    answerKey,
    lineage: input.lineage,

    get createdAt(): Date {
      return new Date(createdAtEpochMilliseconds);
    },
  };

  return Object.freeze(snapshot);
}

export type {
  QuestionVersionContent,
  QuestionVersionAnswerKey,
  QuestionVersionContentFor,
  QuestionVersionAnswerKeyFor,
};

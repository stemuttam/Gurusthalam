import {
  AnswerFormat,
  QuestionId,
  QuestionType,
  QuestionVersionId,
  QuestionVersionLineage,
  QuestionVersionNumber,
  QuestionVersionReference,
  createQuestionVersionSnapshot,
  type AnyQuestionVersionSnapshotInput,
  type QuestionVersionSnapshot,
} from '@gurusthalam/question-bank';

import type {
  QuestionBankAnswerFormat,
  QuestionBankFillBlankSegmentKind,
  QuestionBankMatchingMode,
  QuestionBankType,
} from '@gurusthalam/database';

/**
 * Relation-hydrated QuestionVersion shape required by this mapper.
 *
 * The mapper intentionally accepts an explicit projection rather than a
 * generated Prisma "include" result. Repository code owns the Prisma query;
 * this contract makes the required relation graph visible and testable.
 */
export interface PrismaQuestionVersionRecord {
  readonly id: string;
  readonly questionId: string;
  readonly versionNumber: bigint;
  readonly questionType: QuestionBankType;
  readonly answerFormat: QuestionBankAnswerFormat;
  readonly previousVersionId: string | null;
  readonly restoredFromVersionId: string | null;
  readonly createdAt: Date;
  readonly previousVersion: PrismaQuestionVersionReferenceRecord | null;
  readonly restoredFrom: PrismaQuestionVersionReferenceRecord | null;
  readonly content: PrismaQuestionVersionContentRecord | null;
  readonly answerKey: PrismaQuestionVersionAnswerKeyRecord | null;
}

export interface PrismaQuestionVersionReferenceRecord {
  readonly id: string;
  readonly questionId: string;
  readonly versionNumber: bigint;
}

export interface PrismaQuestionVersionContentRecord {
  readonly id: string;
  readonly questionVersionId: string;
  readonly questionType: QuestionBankType;
  readonly promptText: string | null;
  readonly numericUnit: string | null;
  readonly matchingMode: QuestionBankMatchingMode | null;
  readonly options: readonly PrismaQuestionVersionOptionRecord[];
  readonly matchingLeftItems: readonly PrismaQuestionVersionMatchingItemRecord[];
  readonly matchingRightItems: readonly PrismaQuestionVersionMatchingItemRecord[];
  readonly orderingItems: readonly PrismaQuestionVersionOrderingItemRecord[];
  readonly fillBlankSegments: readonly PrismaQuestionVersionFillBlankSegmentRecord[];
}

export interface PrismaQuestionVersionOptionRecord {
  readonly id: string;
  readonly text: string;
  readonly position: number;
}

export interface PrismaQuestionVersionMatchingItemRecord {
  readonly id: string;
  readonly text: string;
  readonly position: number;
}

export interface PrismaQuestionVersionOrderingItemRecord {
  readonly id: string;
  readonly text: string;
  readonly position: number;
}

export interface PrismaQuestionVersionFillBlankSegmentRecord {
  readonly id: string;
  readonly kind: QuestionBankFillBlankSegmentKind;
  readonly text: string | null;
  readonly blankId: string | null;
  readonly position: number;
}

export interface PrismaQuestionVersionAnswerKeyRecord {
  readonly id: string;
  readonly questionVersionId: string;
  readonly questionType: QuestionBankType;
  readonly correctBoolean: boolean | null;
  readonly expectedNumericValue: number | null;
  readonly referenceAnswer: string | null;
  readonly optionAnswers: readonly PrismaQuestionVersionOptionAnswerRecord[];
  readonly acceptedAnswers: readonly PrismaQuestionVersionAcceptedAnswerRecord[];
  readonly matchingPairs: readonly PrismaQuestionVersionMatchingPairRecord[];
  readonly orderingAnswers: readonly PrismaQuestionVersionOrderingAnswerRecord[];
  readonly blankAnswers: readonly PrismaQuestionVersionBlankAnswerRecord[];
}

export interface PrismaQuestionVersionOptionAnswerRecord {
  readonly optionId: string;
  readonly position: number;
}

export interface PrismaQuestionVersionAcceptedAnswerRecord {
  readonly text: string;
  readonly position: number;
}

export interface PrismaQuestionVersionMatchingPairRecord {
  readonly leftItemId: string;
  readonly rightItemId: string;
  readonly position: number;
}

export interface PrismaQuestionVersionOrderingAnswerRecord {
  readonly itemId: string;
  readonly position: number;
}

export interface PrismaQuestionVersionBlankAnswerRecord {
  readonly blankSegment: {
    readonly blankId: string | null;
  };
  readonly acceptedAnswers: readonly {
    readonly text: string;
    readonly position: number;
  }[];
  readonly position: number;
}

/**
 * Complete nested persistence write contract.
 *
 * Child row identifiers that have no domain identity are deterministic
 * infrastructure identifiers derived from the owning version and position.
 * Stable domain identifiers (option/item/blank IDs) are never regenerated.
 */
export interface PrismaQuestionVersionPersistence {
  readonly question: {
    readonly id: string;
  };
  readonly version: {
    readonly id: string;
    readonly questionId: string;
    readonly versionNumber: bigint;
    readonly questionType: QuestionBankType;
    readonly answerFormat: QuestionBankAnswerFormat;
    readonly previousVersionId: string | null;
    readonly restoredFromVersionId: string | null;
    readonly createdAt: Date;
    readonly content: {
      readonly id: string;
      readonly questionVersionId: string;
      readonly questionType: QuestionBankType;
      readonly promptText: string | null;
      readonly numericUnit: string | null;
      readonly matchingMode: QuestionBankMatchingMode | null;
      readonly options: readonly {
        readonly id: string;
        readonly text: string;
        readonly position: number;
      }[];
      readonly matchingLeftItems: readonly {
        readonly id: string;
        readonly text: string;
        readonly position: number;
      }[];
      readonly matchingRightItems: readonly {
        readonly id: string;
        readonly text: string;
        readonly position: number;
      }[];
      readonly orderingItems: readonly {
        readonly id: string;
        readonly text: string;
        readonly position: number;
      }[];
      readonly fillBlankSegments: readonly {
        readonly id: string;
        readonly kind: QuestionBankFillBlankSegmentKind;
        readonly text: string | null;
        readonly blankId: string | null;
        readonly position: number;
      }[];
    };
    readonly answerKey: {
      readonly id: string;
      readonly questionVersionId: string;
      readonly questionType: QuestionBankType;
      readonly correctBoolean: boolean | null;
      readonly expectedNumericValue: number | null;
      readonly referenceAnswer: string | null;
      readonly optionAnswers: readonly {
        readonly optionId: string;
        readonly position: number;
      }[];
      readonly acceptedAnswers: readonly {
        readonly id: string;
        readonly text: string;
        readonly position: number;
      }[];
      readonly matchingPairs: readonly {
        readonly leftItemId: string;
        readonly rightItemId: string;
        readonly position: number;
      }[];
      readonly orderingAnswers: readonly {
        readonly itemId: string;
        readonly position: number;
      }[];
      readonly blankAnswers: readonly {
        readonly blankSegmentId: string;
        readonly position: number;
        readonly acceptedAnswers: readonly {
          readonly id: string;
          readonly text: string;
          readonly position: number;
        }[];
      }[];
    };
  };
}

export class QuestionVersionPrismaMapper {
  private constructor() {
    // Static mapper.
  }

  static toDomain(
    record: PrismaQuestionVersionRecord,
  ): QuestionVersionSnapshot {
    QuestionVersionPrismaMapper.assertRecord(record);

    const versionNumber = QuestionVersionPrismaMapper.bigintToVersionNumber(
      record.versionNumber,
    );
    const current = QuestionVersionReference.create(
      QuestionVersionId.from(record.id),
      QuestionId.from(record.questionId),
      versionNumber,
    );
    const previous =
      record.previousVersion === null
        ? null
        : QuestionVersionPrismaMapper.toReference(record.previousVersion);
    const restored =
      record.restoredFrom === null
        ? null
        : QuestionVersionPrismaMapper.toReference(record.restoredFrom);

    const lineage = QuestionVersionLineage.create(current, previous, restored);

    // assertRecord narrows both required relations before mapping.
    const content = QuestionVersionPrismaMapper.contentToDomain(
      record.content as PrismaQuestionVersionContentRecord,
    );
    const answerKey = QuestionVersionPrismaMapper.answerKeyToDomain(
      record.answerKey as PrismaQuestionVersionAnswerKeyRecord,
    );

    const input: AnyQuestionVersionSnapshotInput = {
      id: QuestionVersionId.from(record.id),
      questionId: QuestionId.from(record.questionId),
      versionNumber,
      questionType: QuestionVersionPrismaMapper.questionTypeToDomain(
        record.questionType,
      ),
      answerFormat: QuestionVersionPrismaMapper.answerFormatToDomain(
        record.answerFormat,
      ),
      content,
      answerKey,
      lineage,
      createdAt: new Date(record.createdAt),
    } as AnyQuestionVersionSnapshotInput;

    return createQuestionVersionSnapshot(input);
  }

  static toPersistence(
    snapshot: QuestionVersionSnapshot,
  ): PrismaQuestionVersionPersistence {
    if (snapshot === null || typeof snapshot !== 'object') {
      throw new TypeError('QuestionVersion snapshot is required.');
    }

    const versionId = snapshot.id.value;
    const questionId = snapshot.questionId.value;
    const contentId = `${versionId}:content`;
    const answerKeyId = `${versionId}:answer-key`;
    const content = snapshot.content;
    const answerKey = snapshot.answerKey;

    const contentRows = QuestionVersionPrismaMapper.contentToPersistence(
      versionId,
      contentId,
      content,
    );
    const answerRows = QuestionVersionPrismaMapper.answerKeyToPersistence(
      versionId,
      answerKeyId,
      answerKey,
      content,
    );

    return {
      question: { id: questionId },
      version: {
        id: versionId,
        questionId,
        versionNumber: QuestionVersionPrismaMapper.versionNumberToBigint(
          snapshot.versionNumber,
        ),
        questionType: QuestionVersionPrismaMapper.questionTypeToPrisma(
          snapshot.questionType,
        ),
        answerFormat: QuestionVersionPrismaMapper.answerFormatToPrisma(
          snapshot.answerFormat,
        ),
        previousVersionId: snapshot.lineage.previousVersion?.id.value ?? null,
        restoredFromVersionId:
          snapshot.lineage.restoredFromVersion?.id.value ?? null,
        createdAt: new Date(snapshot.createdAt),
        content: contentRows,
        answerKey: answerRows,
      },
    };
  }

  private static assertRecord(
    record: PrismaQuestionVersionRecord,
  ): asserts record is PrismaQuestionVersionRecord {
    if (record === null || typeof record !== 'object') {
      throw new TypeError('Prisma QuestionVersion record is required.');
    }
    if (record.content === null || record.content === undefined) {
      throw new TypeError('A persisted QuestionVersion must have content.');
    }
    if (record.answerKey === null || record.answerKey === undefined) {
      throw new TypeError(
        'A persisted QuestionVersion must have an answer key.',
      );
    }
    if (
      !(record.createdAt instanceof Date) ||
      !Number.isFinite(record.createdAt.getTime())
    ) {
      throw new TypeError('QuestionVersion createdAt must be a valid Date.');
    }
    if (record.content.questionVersionId !== record.id) {
      throw new TypeError(
        'QuestionVersion content belongs to another version.',
      );
    }
    if (record.answerKey.questionVersionId !== record.id) {
      throw new TypeError(
        'QuestionVersion answer key belongs to another version.',
      );
    }
    if (record.content.questionType !== record.questionType) {
      throw new TypeError(
        'QuestionVersion content discriminator does not match its version.',
      );
    }
    if (record.answerKey.questionType !== record.questionType) {
      throw new TypeError(
        'QuestionVersion answer-key discriminator does not match its version.',
      );
    }
    if (
      (record.previousVersionId === null) !==
        (record.previousVersion === null) ||
      (record.restoredFromVersionId === null) !== (record.restoredFrom === null)
    ) {
      throw new TypeError(
        'QuestionVersion lineage relations must be fully hydrated.',
      );
    }
    if (
      record.previousVersion !== null &&
      (record.previousVersion.id !== record.previousVersionId ||
        record.previousVersion.questionId !== record.questionId)
    ) {
      throw new TypeError(
        'Previous-version relation does not match its foreign key.',
      );
    }
    if (
      record.restoredFrom !== null &&
      (record.restoredFrom.id !== record.restoredFromVersionId ||
        record.restoredFrom.questionId !== record.questionId)
    ) {
      throw new TypeError(
        'Restoration relation does not match its foreign key.',
      );
    }
  }

  private static toReference(
    record: PrismaQuestionVersionReferenceRecord,
  ): QuestionVersionReference {
    return QuestionVersionReference.create(
      QuestionVersionId.from(record.id),
      QuestionId.from(record.questionId),
      QuestionVersionPrismaMapper.bigintToVersionNumber(record.versionNumber),
    );
  }

  private static bigintToVersionNumber(value: bigint): QuestionVersionNumber {
    if (typeof value !== 'bigint') {
      throw new TypeError('Prisma versionNumber must be a bigint.');
    }
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < 1n) {
      throw new RangeError(
        'Prisma versionNumber is outside the domain safe-integer range.',
      );
    }
    return QuestionVersionNumber.from(Number(value));
  }

  private static versionNumberToBigint(value: QuestionVersionNumber): bigint {
    if (!(value instanceof QuestionVersionNumber)) {
      throw new TypeError('A valid QuestionVersionNumber is required.');
    }
    return BigInt(value.value);
  }

  private static questionTypeToDomain(value: QuestionBankType) {
    switch (value) {
      case 'SINGLE_CHOICE':
        return QuestionType.SINGLE_CHOICE;
      case 'MULTIPLE_CHOICE':
        return QuestionType.MULTIPLE_CHOICE;
      case 'TRUE_FALSE':
        return QuestionType.TRUE_FALSE;
      case 'SHORT_ANSWER':
        return QuestionType.SHORT_ANSWER;
      case 'LONG_ANSWER':
        return QuestionType.LONG_ANSWER;
      case 'NUMERIC':
        return QuestionType.NUMERIC;
      case 'MATCHING':
        return QuestionType.MATCHING;
      case 'ORDERING':
        return QuestionType.ORDERING;
      case 'FILL_IN_THE_BLANK':
        return QuestionType.FILL_IN_THE_BLANK;
      default:
        throw new TypeError(
          `Unsupported Prisma QuestionBankType: ${String(value)}`,
        );
    }
  }

  private static questionTypeToPrisma(value: string): QuestionBankType {
    switch (value) {
      case QuestionType.SINGLE_CHOICE:
        return 'SINGLE_CHOICE';
      case QuestionType.MULTIPLE_CHOICE:
        return 'MULTIPLE_CHOICE';
      case QuestionType.TRUE_FALSE:
        return 'TRUE_FALSE';
      case QuestionType.SHORT_ANSWER:
        return 'SHORT_ANSWER';
      case QuestionType.LONG_ANSWER:
        return 'LONG_ANSWER';
      case QuestionType.NUMERIC:
        return 'NUMERIC';
      case QuestionType.MATCHING:
        return 'MATCHING';
      case QuestionType.ORDERING:
        return 'ORDERING';
      case QuestionType.FILL_IN_THE_BLANK:
        return 'FILL_IN_THE_BLANK';
      default:
        throw new TypeError(
          `Unsupported domain QuestionType: ${String(value)}`,
        );
    }
  }

  private static answerFormatToDomain(value: QuestionBankAnswerFormat) {
    switch (value) {
      case 'SELECTED_OPTION':
        return AnswerFormat.SELECTED_OPTION;
      case 'SELECTED_OPTIONS':
        return AnswerFormat.SELECTED_OPTIONS;
      case 'BOOLEAN':
        return AnswerFormat.BOOLEAN;
      case 'SHORT_TEXT':
        return AnswerFormat.SHORT_TEXT;
      case 'LONG_TEXT':
        return AnswerFormat.LONG_TEXT;
      case 'NUMBER':
        return AnswerFormat.NUMBER;
      case 'MATCHING_PAIRS':
        return AnswerFormat.MATCHING_PAIRS;
      case 'ORDERED_ITEMS':
        return AnswerFormat.ORDERED_ITEMS;
      case 'BLANK_RESPONSES':
        return AnswerFormat.BLANK_RESPONSES;
      default:
        throw new TypeError(
          `Unsupported Prisma QuestionBankAnswerFormat: ${String(value)}`,
        );
    }
  }

  private static answerFormatToPrisma(value: string): QuestionBankAnswerFormat {
    switch (value) {
      case AnswerFormat.SELECTED_OPTION:
        return 'SELECTED_OPTION';
      case AnswerFormat.SELECTED_OPTIONS:
        return 'SELECTED_OPTIONS';
      case AnswerFormat.BOOLEAN:
        return 'BOOLEAN';
      case AnswerFormat.SHORT_TEXT:
        return 'SHORT_TEXT';
      case AnswerFormat.LONG_TEXT:
        return 'LONG_TEXT';
      case AnswerFormat.NUMBER:
        return 'NUMBER';
      case AnswerFormat.MATCHING_PAIRS:
        return 'MATCHING_PAIRS';
      case AnswerFormat.ORDERED_ITEMS:
        return 'ORDERED_ITEMS';
      case AnswerFormat.BLANK_RESPONSES:
        return 'BLANK_RESPONSES';
      default:
        throw new TypeError(
          `Unsupported domain AnswerFormat: ${String(value)}`,
        );
    }
  }

  /**
   * Validates the persisted ordering contract before sorting.
   * Positions are zero-based, unique, safe integers and contiguous. Silently
   * sorting malformed rows would hide data corruption and make round-trips lossy.
   */
  private static orderedRows<T extends { readonly position: number }>(
    rows: readonly T[],
  ): T[] {
    if (!Array.isArray(rows)) {
      throw new TypeError('Persisted ordered relation must be an array.');
    }

    const seen = new Set<number>();
    for (const row of rows) {
      const position = row?.position;
      if (!Number.isSafeInteger(position) || position < 0) {
        throw new TypeError(
          'Persisted positions must be non-negative safe integers.',
        );
      }
      if (seen.has(position)) {
        throw new TypeError(`Duplicate persisted position: ${position}.`);
      }
      seen.add(position);
    }

    const ordered = [...rows].sort(
      (left, right) => left.position - right.position,
    );
    for (let index = 0; index < ordered.length; index += 1) {
      if (ordered[index]?.position !== index) {
        throw new TypeError(
          'Persisted positions must be contiguous and zero-based.',
        );
      }
    }
    return ordered;
  }

  private static contentToDomain(
    record: PrismaQuestionVersionContentRecord,
  ): AnyQuestionVersionSnapshotInput['content'] {
    const prompt = record.promptText;
    switch (record.questionType) {
      case 'SINGLE_CHOICE':
      case 'MULTIPLE_CHOICE':
        if (prompt === null)
          throw new TypeError('Choice question promptText is required.');
        return {
          questionType: record.questionType,
          prompt: { text: prompt },
          options: QuestionVersionPrismaMapper.orderedRows(record.options).map(
            ({ id, text }) => ({ id, text }),
          ),
        } as AnyQuestionVersionSnapshotInput['content'];
      case 'TRUE_FALSE':
      case 'SHORT_ANSWER':
      case 'LONG_ANSWER':
        if (prompt === null)
          throw new TypeError('Question promptText is required.');
        return {
          questionType: record.questionType,
          prompt: { text: prompt },
        } as AnyQuestionVersionSnapshotInput['content'];
      case 'NUMERIC':
        if (prompt === null)
          throw new TypeError('Numeric question promptText is required.');
        return {
          questionType: record.questionType,
          prompt: { text: prompt },
          unit: record.numericUnit,
        } as AnyQuestionVersionSnapshotInput['content'];
      case 'MATCHING':
        if (prompt === null || record.matchingMode === null)
          throw new TypeError('Matching prompt and matchingMode are required.');
        return {
          questionType: 'MATCHING',
          matchingMode: record.matchingMode,
          prompt: { text: prompt },
          leftItems: QuestionVersionPrismaMapper.orderedRows(
            record.matchingLeftItems,
          ).map(({ id, text }) => ({ id, text })),
          rightItems: QuestionVersionPrismaMapper.orderedRows(
            record.matchingRightItems,
          ).map(({ id, text }) => ({ id, text })),
        } as AnyQuestionVersionSnapshotInput['content'];
      case 'ORDERING':
        if (prompt === null)
          throw new TypeError('Ordering question promptText is required.');
        return {
          questionType: 'ORDERING',
          prompt: { text: prompt },
          items: QuestionVersionPrismaMapper.orderedRows(
            record.orderingItems,
          ).map(({ id, text }) => ({ id, text })),
        } as AnyQuestionVersionSnapshotInput['content'];
      case 'FILL_IN_THE_BLANK':
        if (record.promptText !== null)
          throw new TypeError(
            'Fill-in-the-blank prompt must be represented by segments.',
          );
        return {
          questionType: 'FILL_IN_THE_BLANK',
          prompt: {
            segments: QuestionVersionPrismaMapper.orderedRows(
              record.fillBlankSegments,
            ).map((segment) => {
              if (segment.kind === 'TEXT') {
                if (segment.text === null || segment.blankId !== null)
                  throw new TypeError(
                    'TEXT segment must have text and no blankId.',
                  );
                return { kind: 'TEXT' as const, text: segment.text };
              }
              if (segment.kind !== 'BLANK') {
                throw new TypeError(
                  `Unsupported fill-in-the-blank segment kind: ${String(segment.kind)}`,
                );
              }
              if (segment.text !== null || segment.blankId === null)
                throw new TypeError(
                  'BLANK segment must have blankId and no text.',
                );
              return { kind: 'BLANK' as const, blankId: segment.blankId };
            }),
          },
        } as AnyQuestionVersionSnapshotInput['content'];
      default:
        throw new TypeError(
          `Unsupported content question type: ${String(record.questionType)}`,
        );
    }
  }

  private static answerKeyToDomain(
    record: PrismaQuestionVersionAnswerKeyRecord,
  ): AnyQuestionVersionSnapshotInput['answerKey'] {
    switch (record.questionType) {
      case 'SINGLE_CHOICE': {
        const answers = QuestionVersionPrismaMapper.orderedRows(
          record.optionAnswers,
        );
        if (answers.length !== 1)
          throw new TypeError(
            'SINGLE_CHOICE requires exactly one option answer.',
          );
        const answer = answers[0];
        if (answer === undefined)
          throw new TypeError(
            'SINGLE_CHOICE requires exactly one option answer.',
          );
        return {
          questionType: 'SINGLE_CHOICE',
          correctOptionId: answer.optionId,
        } as AnyQuestionVersionSnapshotInput['answerKey'];
      }
      case 'MULTIPLE_CHOICE':
        return {
          questionType: 'MULTIPLE_CHOICE',
          correctOptionIds: QuestionVersionPrismaMapper.orderedRows(
            record.optionAnswers,
          ).map((x) => x.optionId),
        } as AnyQuestionVersionSnapshotInput['answerKey'];
      case 'TRUE_FALSE':
        if (record.correctBoolean === null)
          throw new TypeError('TRUE_FALSE correctBoolean is required.');
        return {
          questionType: 'TRUE_FALSE',
          correctValue: record.correctBoolean,
        } as AnyQuestionVersionSnapshotInput['answerKey'];
      case 'SHORT_ANSWER':
        return {
          questionType: 'SHORT_ANSWER',
          acceptedAnswers: QuestionVersionPrismaMapper.orderedRows(
            record.acceptedAnswers,
          ).map((x) => x.text),
        } as AnyQuestionVersionSnapshotInput['answerKey'];
      case 'LONG_ANSWER':
        if (record.referenceAnswer === null)
          throw new TypeError('LONG_ANSWER referenceAnswer is required.');
        return {
          questionType: 'LONG_ANSWER',
          referenceAnswer: record.referenceAnswer,
        } as AnyQuestionVersionSnapshotInput['answerKey'];
      case 'NUMERIC':
        if (record.expectedNumericValue === null)
          throw new TypeError('NUMERIC expectedNumericValue is required.');
        return {
          questionType: 'NUMERIC',
          expectedValue: record.expectedNumericValue,
        } as AnyQuestionVersionSnapshotInput['answerKey'];
      case 'MATCHING':
        return {
          questionType: 'MATCHING',
          correctPairs: QuestionVersionPrismaMapper.orderedRows(
            record.matchingPairs,
          ).map(({ leftItemId, rightItemId }) => ({ leftItemId, rightItemId })),
        } as AnyQuestionVersionSnapshotInput['answerKey'];
      case 'ORDERING':
        return {
          questionType: 'ORDERING',
          correctOrderedItemIds: QuestionVersionPrismaMapper.orderedRows(
            record.orderingAnswers,
          ).map((x) => x.itemId),
        } as AnyQuestionVersionSnapshotInput['answerKey'];
      case 'FILL_IN_THE_BLANK':
        return {
          questionType: 'FILL_IN_THE_BLANK',
          blanks: QuestionVersionPrismaMapper.orderedRows(
            record.blankAnswers,
          ).map((blank) => {
            if (blank.blankSegment.blankId === null)
              throw new TypeError(
                'Blank answer points to a segment without blankId.',
              );
            return {
              blankId: blank.blankSegment.blankId,
              acceptedAnswers: QuestionVersionPrismaMapper.orderedRows(
                blank.acceptedAnswers,
              ).map((x) => x.text),
            };
          }),
        } as AnyQuestionVersionSnapshotInput['answerKey'];
      default:
        throw new TypeError(
          `Unsupported answer-key question type: ${String(record.questionType)}`,
        );
    }
  }

  private static contentToPersistence(
    versionId: string,
    contentId: string,
    content: QuestionVersionSnapshot['content'],
  ): PrismaQuestionVersionPersistence['version']['content'] {
    const base = {
      id: contentId,
      questionVersionId: versionId,
      questionType: QuestionVersionPrismaMapper.questionTypeToPrisma(
        content.questionType,
      ),
      promptText: null as string | null,
      numericUnit: null as string | null,
      matchingMode: null as QuestionBankMatchingMode | null,
      options: [] as { id: string; text: string; position: number }[],
      matchingLeftItems: [] as { id: string; text: string; position: number }[],
      matchingRightItems: [] as {
        id: string;
        text: string;
        position: number;
      }[],
      orderingItems: [] as { id: string; text: string; position: number }[],
      fillBlankSegments: [] as {
        id: string;
        kind: QuestionBankFillBlankSegmentKind;
        text: string | null;
        blankId: string | null;
        position: number;
      }[],
    };

    switch (content.questionType) {
      case 'SINGLE_CHOICE':
      case 'MULTIPLE_CHOICE':
        return {
          ...base,
          promptText: content.prompt.text,
          options: content.options.map((x, position) => ({
            id: x.id,
            text: x.text,
            position,
          })),
        };
      case 'TRUE_FALSE':
      case 'SHORT_ANSWER':
      case 'LONG_ANSWER':
        return { ...base, promptText: content.prompt.text };
      case 'NUMERIC':
        return {
          ...base,
          promptText: content.prompt.text,
          numericUnit: content.unit,
        };
      case 'MATCHING':
        return {
          ...base,
          promptText: content.prompt.text,
          matchingMode: content.matchingMode,
          matchingLeftItems: content.leftItems.map((x, position) => ({
            id: x.id,
            text: x.text,
            position,
          })),
          matchingRightItems: content.rightItems.map((x, position) => ({
            id: x.id,
            text: x.text,
            position,
          })),
        };
      case 'ORDERING':
        return {
          ...base,
          promptText: content.prompt.text,
          orderingItems: content.items.map((x, position) => ({
            id: x.id,
            text: x.text,
            position,
          })),
        };
      case 'FILL_IN_THE_BLANK':
        return {
          ...base,
          fillBlankSegments: content.prompt.segments.map(
            (segment, position) => ({
              id: `${versionId}:segment:${position}`,
              kind: segment.kind,
              text: segment.kind === 'TEXT' ? segment.text : null,
              blankId: segment.kind === 'BLANK' ? segment.blankId : null,
              position,
            }),
          ),
        };
    }
  }

  private static answerKeyToPersistence(
    versionId: string,
    answerKeyId: string,
    answerKey: QuestionVersionSnapshot['answerKey'],
    content: QuestionVersionSnapshot['content'],
  ): PrismaQuestionVersionPersistence['version']['answerKey'] {
    const base = {
      id: answerKeyId,
      questionVersionId: versionId,
      questionType: QuestionVersionPrismaMapper.questionTypeToPrisma(
        answerKey.questionType,
      ),
      correctBoolean: null as boolean | null,
      expectedNumericValue: null as number | null,
      referenceAnswer: null as string | null,
      optionAnswers: [] as { optionId: string; position: number }[],
      acceptedAnswers: [] as { id: string; text: string; position: number }[],
      matchingPairs: [] as {
        leftItemId: string;
        rightItemId: string;
        position: number;
      }[],
      orderingAnswers: [] as { itemId: string; position: number }[],
      blankAnswers: [] as {
        blankSegmentId: string;
        position: number;
        acceptedAnswers: { id: string; text: string; position: number }[];
      }[],
    };

    switch (answerKey.questionType) {
      case 'SINGLE_CHOICE':
        return {
          ...base,
          optionAnswers: [{ optionId: answerKey.correctOptionId, position: 0 }],
        };
      case 'MULTIPLE_CHOICE':
        return {
          ...base,
          optionAnswers: answerKey.correctOptionIds.map(
            (optionId, position) => ({ optionId, position }),
          ),
        };
      case 'TRUE_FALSE':
        return { ...base, correctBoolean: answerKey.correctValue };
      case 'SHORT_ANSWER':
        return {
          ...base,
          acceptedAnswers: answerKey.acceptedAnswers.map((text, position) => ({
            id: `${versionId}:accepted:${position}`,
            text,
            position,
          })),
        };
      case 'LONG_ANSWER':
        return { ...base, referenceAnswer: answerKey.referenceAnswer };
      case 'NUMERIC':
        return { ...base, expectedNumericValue: answerKey.expectedValue };
      case 'MATCHING':
        return {
          ...base,
          matchingPairs: answerKey.correctPairs.map((pair, position) => ({
            ...pair,
            position,
          })),
        };
      case 'ORDERING':
        return {
          ...base,
          orderingAnswers: answerKey.correctOrderedItemIds.map(
            (itemId, position) => ({ itemId, position }),
          ),
        };
      case 'FILL_IN_THE_BLANK': {
        if (content.questionType !== 'FILL_IN_THE_BLANK')
          throw new TypeError('Answer key/content discriminator mismatch.');
        const segmentIds = new Map<string, string>();
        content.prompt.segments.forEach((segment, position) => {
          if (segment.kind === 'BLANK')
            segmentIds.set(segment.blankId, `${versionId}:segment:${position}`);
        });
        return {
          ...base,
          blankAnswers: answerKey.blanks.map((blank, position) => {
            const blankSegmentId = segmentIds.get(blank.blankId);
            if (blankSegmentId === undefined)
              throw new TypeError(
                `No persisted blank segment for ${blank.blankId}.`,
              );
            return {
              blankSegmentId,
              position,
              acceptedAnswers: blank.acceptedAnswers.map(
                (text, answerPosition) => ({
                  id: `${versionId}:blank:${position}:accepted:${answerPosition}`,
                  text,
                  position: answerPosition,
                }),
              ),
            };
          }),
        };
      }
    }
  }
}

import { describe, expect, it } from 'vitest';

import * as QuestionBankPublicApi from './index.js';

describe('Question Bank public API contract', () => {
  describe('Question identity exports', () => {
    it('exports QuestionId', () => {
      expect(QuestionBankPublicApi.QuestionId).toBeDefined();
      expect(typeof QuestionBankPublicApi.QuestionId.generate).toBe('function');
      expect(typeof QuestionBankPublicApi.QuestionId.from).toBe('function');
      expect(typeof QuestionBankPublicApi.QuestionId.isValid).toBe('function');
    });

    it('supports identity generation through the public entry point', () => {
      const id = QuestionBankPublicApi.QuestionId.generate();

      expect(id).toBeInstanceOf(QuestionBankPublicApi.QuestionId);
      expect(QuestionBankPublicApi.QuestionId.isValid(id.toString())).toBe(
        true,
      );
    });

    it('supports identity rehydration through the public entry point', () => {
      const id = QuestionBankPublicApi.QuestionId.from(
        'public-api-question-001',
      );

      expect(id.toString()).toBe('public-api-question-001');
    });

    it('preserves identity value equality through the public entry point', () => {
      const first = QuestionBankPublicApi.QuestionId.from(
        'public-api-question-001',
      );
      const second = QuestionBankPublicApi.QuestionId.from(
        'public-api-question-001',
      );

      expect(first.equals(second)).toBe(true);
    });
  });

  describe('Question version identity exports', () => {
    it('exports QuestionVersionId', () => {
      expect(QuestionBankPublicApi.QuestionVersionId).toBeDefined();
      expect(typeof QuestionBankPublicApi.QuestionVersionId.generate).toBe(
        'function',
      );
      expect(typeof QuestionBankPublicApi.QuestionVersionId.from).toBe(
        'function',
      );
      expect(typeof QuestionBankPublicApi.QuestionVersionId.isValid).toBe(
        'function',
      );
    });

    it('supports version identity generation through the public entry point', () => {
      const id = QuestionBankPublicApi.QuestionVersionId.generate();

      expect(id).toBeInstanceOf(QuestionBankPublicApi.QuestionVersionId);
      expect(
        QuestionBankPublicApi.QuestionVersionId.isValid(id.toString()),
      ).toBe(true);
    });

    it('supports version identity rehydration through the public entry point', () => {
      const id = QuestionBankPublicApi.QuestionVersionId.from(
        'public-api-question-version-001',
      );

      expect(id.toString()).toBe('public-api-question-version-001');
    });

    it('preserves version identity equality through the public entry point', () => {
      const first = QuestionBankPublicApi.QuestionVersionId.from(
        'public-api-question-version-001',
      );
      const second = QuestionBankPublicApi.QuestionVersionId.from(
        'public-api-question-version-001',
      );

      expect(first.equals(second)).toBe(true);
    });

    it('keeps QuestionId and QuestionVersionId distinct', () => {
      const questionId = QuestionBankPublicApi.QuestionId.from(
        'shared-public-api-identity',
      );
      const versionId = QuestionBankPublicApi.QuestionVersionId.from(
        'shared-public-api-identity',
      );

      expect(questionId).not.toBeInstanceOf(
        QuestionBankPublicApi.QuestionVersionId,
      );
      expect(versionId).not.toBeInstanceOf(QuestionBankPublicApi.QuestionId);
    });
  });

  describe('Question version number exports', () => {
    it('exports QuestionVersionNumber', () => {
      expect(QuestionBankPublicApi.QuestionVersionNumber).toBeDefined();
      expect(typeof QuestionBankPublicApi.QuestionVersionNumber.initial).toBe(
        'function',
      );
      expect(typeof QuestionBankPublicApi.QuestionVersionNumber.from).toBe(
        'function',
      );
      expect(typeof QuestionBankPublicApi.QuestionVersionNumber.isValid).toBe(
        'function',
      );
    });

    it('creates the initial version through the public entry point', () => {
      const version = QuestionBankPublicApi.QuestionVersionNumber.initial();

      expect(version.value).toBe(1);
    });

    it('supports version number rehydration through the public entry point', () => {
      const version = QuestionBankPublicApi.QuestionVersionNumber.from(7);

      expect(version.value).toBe(7);
      expect(version.toNumber()).toBe(7);
    });

    it('supports sequential advancement through the public entry point', () => {
      const first = QuestionBankPublicApi.QuestionVersionNumber.initial();
      const second = first.next();

      expect(first.value).toBe(1);
      expect(second.value).toBe(2);
    });

    it('exposes the positive safe-integer validation contract', () => {
      expect(QuestionBankPublicApi.QuestionVersionNumber.isValid(1)).toBe(true);
      expect(QuestionBankPublicApi.QuestionVersionNumber.isValid(0)).toBe(
        false,
      );
      expect(QuestionBankPublicApi.QuestionVersionNumber.isValid(1.5)).toBe(
        false,
      );
    });
  });

  describe('Question version reference public API', () => {
    it('exports QuestionVersionReference', () => {
      expect(QuestionBankPublicApi.QuestionVersionReference).toBeDefined();
      expect(typeof QuestionBankPublicApi.QuestionVersionReference.create).toBe(
        'function',
      );
    });

    it('creates a version reference through the public entry point', () => {
      const id = QuestionBankPublicApi.QuestionVersionId.generate();
      const questionId = QuestionBankPublicApi.QuestionId.generate();
      const versionNumber =
        QuestionBankPublicApi.QuestionVersionNumber.initial();

      const reference = QuestionBankPublicApi.QuestionVersionReference.create(
        id,
        questionId,
        versionNumber,
      );

      expect(reference).toBeInstanceOf(
        QuestionBankPublicApi.QuestionVersionReference,
      );
      expect(reference.id).toBe(id);
      expect(reference.questionId).toBe(questionId);
      expect(reference.versionNumber).toBe(versionNumber);
    });

    it('preserves version reference equality through the public entry point', () => {
      const id = QuestionBankPublicApi.QuestionVersionId.generate();
      const questionId = QuestionBankPublicApi.QuestionId.generate();
      const versionNumber = QuestionBankPublicApi.QuestionVersionNumber.from(2);

      const first = QuestionBankPublicApi.QuestionVersionReference.create(
        id,
        questionId,
        versionNumber,
      );

      const equivalent = QuestionBankPublicApi.QuestionVersionReference.create(
        QuestionBankPublicApi.QuestionVersionId.from(id.value),
        QuestionBankPublicApi.QuestionId.from(questionId.value),
        QuestionBankPublicApi.QuestionVersionNumber.from(2),
      );

      expect(first.equals(equivalent)).toBe(true);
    });
  });

  describe('Question version lineage public API', () => {
    it('exports QuestionVersionLineage', () => {
      expect(QuestionBankPublicApi.QuestionVersionLineage).toBeDefined();
      expect(typeof QuestionBankPublicApi.QuestionVersionLineage.create).toBe(
        'function',
      );
    });

    it('creates initial version lineage through the public entry point', () => {
      const questionId = QuestionBankPublicApi.QuestionId.generate();

      const current = QuestionBankPublicApi.QuestionVersionReference.create(
        QuestionBankPublicApi.QuestionVersionId.generate(),
        questionId,
        QuestionBankPublicApi.QuestionVersionNumber.initial(),
      );

      const lineage =
        QuestionBankPublicApi.QuestionVersionLineage.create(current);

      expect(lineage.currentVersion).toBe(current);
      expect(lineage.previousVersion).toBeNull();
      expect(lineage.restoredFromVersion).toBeNull();
      expect(lineage.isInitialVersion).toBe(true);
      expect(lineage.isRestoration).toBe(false);
    });

    it('creates ordinary revision lineage through the public entry point', () => {
      const questionId = QuestionBankPublicApi.QuestionId.generate();

      const previous = QuestionBankPublicApi.QuestionVersionReference.create(
        QuestionBankPublicApi.QuestionVersionId.generate(),
        questionId,
        QuestionBankPublicApi.QuestionVersionNumber.initial(),
      );

      const current = QuestionBankPublicApi.QuestionVersionReference.create(
        QuestionBankPublicApi.QuestionVersionId.generate(),
        questionId,
        previous.versionNumber.next(),
      );

      const lineage = QuestionBankPublicApi.QuestionVersionLineage.create(
        current,
        previous,
      );

      expect(lineage.previousVersion).toBe(previous);
      expect(lineage.restoredFromVersion).toBeNull();
      expect(lineage.isInitialVersion).toBe(false);
      expect(lineage.isRestoration).toBe(false);
    });

    it('preserves historical restoration provenance through the public entry point', () => {
      const questionId = QuestionBankPublicApi.QuestionId.generate();

      const version1 = QuestionBankPublicApi.QuestionVersionReference.create(
        QuestionBankPublicApi.QuestionVersionId.generate(),
        questionId,
        QuestionBankPublicApi.QuestionVersionNumber.from(1),
      );

      const version2 = QuestionBankPublicApi.QuestionVersionReference.create(
        QuestionBankPublicApi.QuestionVersionId.generate(),
        questionId,
        QuestionBankPublicApi.QuestionVersionNumber.from(2),
      );

      const version3 = QuestionBankPublicApi.QuestionVersionReference.create(
        QuestionBankPublicApi.QuestionVersionId.generate(),
        questionId,
        QuestionBankPublicApi.QuestionVersionNumber.from(3),
      );

      const version4 = QuestionBankPublicApi.QuestionVersionReference.create(
        QuestionBankPublicApi.QuestionVersionId.generate(),
        questionId,
        QuestionBankPublicApi.QuestionVersionNumber.from(4),
      );

      const version2Lineage =
        QuestionBankPublicApi.QuestionVersionLineage.create(version2, version1);

      const version3Lineage =
        QuestionBankPublicApi.QuestionVersionLineage.create(version3, version2);

      const version4Lineage =
        QuestionBankPublicApi.QuestionVersionLineage.create(
          version4,
          version3,
          version1,
        );

      expect(version2Lineage.previousVersion).toBe(version1);
      expect(version2Lineage.isInitialVersion).toBe(false);
      expect(version2Lineage.isRestoration).toBe(false);

      expect(version3Lineage.previousVersion).toBe(version2);
      expect(version3Lineage.isInitialVersion).toBe(false);
      expect(version3Lineage.isRestoration).toBe(false);

      expect(version4Lineage.currentVersion).toBe(version4);
      expect(version4Lineage.previousVersion).toBe(version3);
      expect(version4Lineage.restoredFromVersion).toBe(version1);
      expect(version4Lineage.isRestoration).toBe(true);
    });
  });

  describe('Question type public API', () => {
    it('exports the complete question type taxonomy', () => {
      expect(QuestionBankPublicApi.QUESTION_TYPES).toHaveLength(9);
      expect(QuestionBankPublicApi.QuestionType).toBeDefined();
    });

    it('exports the question type runtime guard', () => {
      expect(
        QuestionBankPublicApi.isQuestionType(
          QuestionBankPublicApi.QuestionType.SINGLE_CHOICE,
        ),
      ).toBe(true);

      expect(QuestionBankPublicApi.isQuestionType('UNSUPPORTED')).toBe(false);
    });
  });

  describe('Answer format public API', () => {
    it('exports the complete answer format taxonomy', () => {
      expect(QuestionBankPublicApi.ANSWER_FORMATS).toHaveLength(9);
      expect(QuestionBankPublicApi.AnswerFormat).toBeDefined();
    });

    it('exports the answer format runtime guard', () => {
      expect(
        QuestionBankPublicApi.isAnswerFormat(
          QuestionBankPublicApi.AnswerFormat.SELECTED_OPTION,
        ),
      ).toBe(true);

      expect(QuestionBankPublicApi.isAnswerFormat('UNSUPPORTED')).toBe(false);
    });
  });

  describe('Question-answer compatibility public API', () => {
    it('exports the compatibility contract', () => {
      expect(QuestionBankPublicApi.QUESTION_ANSWER_COMPATIBILITY).toBeDefined();
    });

    it('exposes supported formats through the public entry point', () => {
      expect(
        QuestionBankPublicApi.getSupportedAnswerFormats(
          QuestionBankPublicApi.QuestionType.SINGLE_CHOICE,
        ),
      ).toEqual([QuestionBankPublicApi.AnswerFormat.SELECTED_OPTION]);
    });

    it('validates compatible question and answer combinations', () => {
      expect(
        QuestionBankPublicApi.isSupportedAnswerFormat(
          QuestionBankPublicApi.QuestionType.MULTIPLE_CHOICE,
          QuestionBankPublicApi.AnswerFormat.SELECTED_OPTIONS,
        ),
      ).toBe(true);
    });

    it('rejects incompatible question and answer combinations', () => {
      expect(
        QuestionBankPublicApi.isSupportedAnswerFormat(
          QuestionBankPublicApi.QuestionType.SINGLE_CHOICE,
          QuestionBankPublicApi.AnswerFormat.SELECTED_OPTIONS,
        ),
      ).toBe(false);
    });
  });
});

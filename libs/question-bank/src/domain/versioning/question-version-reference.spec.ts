import { describe, expect, it } from 'vitest';

import { QuestionId } from '../identifiers/question-id.js';
import { QuestionVersionId } from '../identifiers/question-version-id.js';
import { QuestionVersionNumber } from '../identifiers/question-version-number.js';
import { QuestionVersionReference } from './question-version-reference.js';

describe('QuestionVersionReference', () => {
  const createReference = (
    versionNumber = 1,
    questionId = QuestionId.generate(),
  ): QuestionVersionReference =>
    QuestionVersionReference.create(
      QuestionVersionId.generate(),
      questionId,
      QuestionVersionNumber.from(versionNumber),
    );

  it('creates a reference with its version identity and ownership metadata', () => {
    const id = QuestionVersionId.generate();
    const questionId = QuestionId.generate();
    const versionNumber = QuestionVersionNumber.initial();

    const reference = QuestionVersionReference.create(
      id,
      questionId,
      versionNumber,
    );

    expect(reference.id).toBe(id);
    expect(reference.questionId).toBe(questionId);
    expect(reference.versionNumber).toBe(versionNumber);
  });

  it('rejects an invalid version identifier at runtime', () => {
    expect(() =>
      QuestionVersionReference.create(
        null as unknown as QuestionVersionId,
        QuestionId.generate(),
        QuestionVersionNumber.initial(),
      ),
    ).toThrow(TypeError);
  });

  it('rejects an invalid question identifier at runtime', () => {
    expect(() =>
      QuestionVersionReference.create(
        QuestionVersionId.generate(),
        null as unknown as QuestionId,
        QuestionVersionNumber.initial(),
      ),
    ).toThrow(TypeError);
  });

  it('rejects an invalid version number at runtime', () => {
    expect(() =>
      QuestionVersionReference.create(
        QuestionVersionId.generate(),
        QuestionId.generate(),
        null as unknown as QuestionVersionNumber,
      ),
    ).toThrow(TypeError);
  });

  it('compares references using version ID, question ownership, and version number', () => {
    const id = QuestionVersionId.generate();
    const questionId = QuestionId.generate();
    const versionNumber = QuestionVersionNumber.from(2);

    const first = QuestionVersionReference.create(
      id,
      questionId,
      versionNumber,
    );

    const equivalent = QuestionVersionReference.create(
      QuestionVersionId.from(id.value),
      QuestionId.from(questionId.value),
      QuestionVersionNumber.from(2),
    );

    expect(first.equals(equivalent)).toBe(true);
  });

  it('does not consider references with different version IDs equal', () => {
    const questionId = QuestionId.generate();
    const versionNumber = QuestionVersionNumber.initial();

    const first = QuestionVersionReference.create(
      QuestionVersionId.generate(),
      questionId,
      versionNumber,
    );

    const second = QuestionVersionReference.create(
      QuestionVersionId.generate(),
      questionId,
      versionNumber,
    );

    expect(first.equals(second)).toBe(false);
  });

  it('does not consider references with different question owners equal', () => {
    const id = QuestionVersionId.generate();
    const versionNumber = QuestionVersionNumber.initial();

    const first = QuestionVersionReference.create(
      id,
      QuestionId.generate(),
      versionNumber,
    );

    const second = QuestionVersionReference.create(
      QuestionVersionId.from(id.value),
      QuestionId.generate(),
      QuestionVersionNumber.initial(),
    );

    expect(first.equals(second)).toBe(false);
  });

  it('does not consider references with different version numbers equal', () => {
    const id = QuestionVersionId.generate();
    const questionId = QuestionId.generate();

    const first = QuestionVersionReference.create(
      id,
      questionId,
      QuestionVersionNumber.from(1),
    );

    const second = QuestionVersionReference.create(
      QuestionVersionId.from(id.value),
      QuestionId.from(questionId.value),
      QuestionVersionNumber.from(2),
    );

    expect(first.equals(second)).toBe(false);
  });

  it('is immutable', () => {
    const reference = createReference();

    expect(Object.isFrozen(reference)).toBe(true);
  });

  it('does not modify the supplied identity value objects', () => {
    const id = QuestionVersionId.generate();
    const questionId = QuestionId.generate();
    const versionNumber = QuestionVersionNumber.initial();

    QuestionVersionReference.create(id, questionId, versionNumber);

    expect(Object.isFrozen(id)).toBe(true);
    expect(Object.isFrozen(questionId)).toBe(true);
    expect(Object.isFrozen(versionNumber)).toBe(true);
  });
});

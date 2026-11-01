import { describe, expect, it } from 'vitest';

import { QuestionId } from '../identifiers/question-id.js';
import { QuestionVersionId } from '../identifiers/question-version-id.js';
import { QuestionVersionNumber } from '../identifiers/question-version-number.js';
import { QuestionVersionLineage } from './question-version-lineage.js';
import { QuestionVersionReference } from './question-version-reference.js';

describe('QuestionVersionLineage', () => {
  const createReference = (
    questionId: QuestionId,
    versionNumber: number,
    id = QuestionVersionId.generate(),
  ): QuestionVersionReference =>
    QuestionVersionReference.create(
      id,
      questionId,
      QuestionVersionNumber.from(versionNumber),
    );

  it('creates initial version lineage without predecessor or restoration source', () => {
    const questionId = QuestionId.generate();
    const current = createReference(questionId, 1);

    const lineage = QuestionVersionLineage.create(current);

    expect(lineage.currentVersion).toBe(current);
    expect(lineage.previousVersion).toBeNull();
    expect(lineage.restoredFromVersion).toBeNull();
    expect(lineage.isInitialVersion).toBe(true);
    expect(lineage.isRestoration).toBe(false);
  });

  it('creates ordinary revision lineage with its immediate predecessor', () => {
    const questionId = QuestionId.generate();
    const previous = createReference(questionId, 1);
    const current = createReference(questionId, 2);

    const lineage = QuestionVersionLineage.create(current, previous);

    expect(lineage.previousVersion).toBe(previous);
    expect(lineage.restoredFromVersion).toBeNull();
    expect(lineage.isInitialVersion).toBe(false);
    expect(lineage.isRestoration).toBe(false);
  });

  it('creates restoration lineage with separate predecessor and historical source', () => {
    const questionId = QuestionId.generate();
    const version1 = createReference(questionId, 1);
    const version2 = createReference(questionId, 2);
    const version3 = createReference(questionId, 3);
    const version4 = createReference(questionId, 4);

    const lineage = QuestionVersionLineage.create(version4, version3, version1);

    expect(lineage.currentVersion).toBe(version4);
    expect(lineage.previousVersion).toBe(version3);
    expect(lineage.restoredFromVersion).toBe(version1);
    expect(lineage.isInitialVersion).toBe(false);
    expect(lineage.isRestoration).toBe(true);
    expect(version2.versionNumber.value).toBe(2);
  });

  it('allows the immediate predecessor to also be the restoration source', () => {
    const questionId = QuestionId.generate();
    const version1 = createReference(questionId, 1);
    const version2 = createReference(questionId, 2);

    const lineage = QuestionVersionLineage.create(
      version2,
      version1,
      QuestionVersionReference.create(
        QuestionVersionId.from(version1.id.value),
        QuestionId.from(questionId.value),
        QuestionVersionNumber.from(1),
      ),
    );

    expect(lineage.previousVersion?.equals(version1)).toBe(true);
    expect(lineage.restoredFromVersion?.equals(version1)).toBe(true);
    expect(lineage.isRestoration).toBe(true);
  });

  it('rejects different version identities with the same version number for one question', () => {
    const questionId = QuestionId.generate();
    const previous = createReference(questionId, 2);
    const restorationSource = createReference(questionId, 2);
    const current = createReference(questionId, 3);

    expect(() =>
      QuestionVersionLineage.create(current, previous, restorationSource),
    ).toThrow(/same version number/i);
  });

  it('rejects an invalid current version reference', () => {
    expect(() =>
      QuestionVersionLineage.create(
        null as unknown as QuestionVersionReference,
      ),
    ).toThrow(TypeError);
  });

  it('rejects an invalid predecessor reference', () => {
    const current = createReference(QuestionId.generate(), 2);

    expect(() =>
      QuestionVersionLineage.create(
        current,
        null as unknown as QuestionVersionReference,
      ),
    ).toThrow(TypeError);
  });

  it('rejects an explicitly supplied undefined predecessor', () => {
    const current = createReference(QuestionId.generate(), 2);

    expect(() =>
      QuestionVersionLineage.create(
        current,
        undefined as unknown as QuestionVersionReference,
      ),
    ).toThrow(TypeError);
  });

  it('rejects a non-reference predecessor object', () => {
    const current = createReference(QuestionId.generate(), 2);

    expect(() =>
      QuestionVersionLineage.create(
        current,
        {} as unknown as QuestionVersionReference,
      ),
    ).toThrow(TypeError);
  });

  it('rejects an invalid restoration source reference', () => {
    const questionId = QuestionId.generate();
    const previous = createReference(questionId, 1);
    const current = createReference(questionId, 2);

    expect(() =>
      QuestionVersionLineage.create(
        current,
        previous,
        undefined as unknown as QuestionVersionReference,
      ),
    ).toThrow(TypeError);
  });

  it('rejects a non-reference restoration source object', () => {
    const questionId = QuestionId.generate();
    const previous = createReference(questionId, 1);
    const current = createReference(questionId, 2);

    expect(() =>
      QuestionVersionLineage.create(
        current,
        previous,
        {} as unknown as QuestionVersionReference,
      ),
    ).toThrow(TypeError);
  });

  it('accepts explicit null relationships for an initial version', () => {
    const current = createReference(QuestionId.generate(), 1);

    const lineage = QuestionVersionLineage.create(current, null, null);

    expect(lineage.currentVersion).toBe(current);
    expect(lineage.previousVersion).toBeNull();
    expect(lineage.restoredFromVersion).toBeNull();
    expect(lineage.isInitialVersion).toBe(true);
    expect(lineage.isRestoration).toBe(false);
  });

  it('accepts an explicit null restoration source for an ordinary revision', () => {
    const questionId = QuestionId.generate();
    const previous = createReference(questionId, 1);
    const current = createReference(questionId, 2);

    const lineage = QuestionVersionLineage.create(current, previous, null);

    expect(lineage.previousVersion).toBe(previous);
    expect(lineage.restoredFromVersion).toBeNull();
    expect(lineage.isInitialVersion).toBe(false);
    expect(lineage.isRestoration).toBe(false);
  });

  it('rejects an initial version with a predecessor', () => {
    const questionId = QuestionId.generate();
    const current = createReference(questionId, 1);
    const previous = createReference(questionId, 1);

    expect(() => QuestionVersionLineage.create(current, previous)).toThrow(
      /initial question version/i,
    );
  });

  it('rejects an initial version with a restoration source', () => {
    const questionId = QuestionId.generate();
    const current = createReference(questionId, 1);
    const source = createReference(questionId, 1);

    expect(() => QuestionVersionLineage.create(current, null, source)).toThrow(
      /earlier question version/i,
    );
  });

  it('rejects a later version without a predecessor', () => {
    const current = createReference(QuestionId.generate(), 2);

    expect(() => QuestionVersionLineage.create(current)).toThrow(
      /must have an immediate predecessor/i,
    );
  });

  it('rejects a predecessor owned by another question', () => {
    const current = createReference(QuestionId.generate(), 2);
    const previous = createReference(QuestionId.generate(), 1);

    expect(() => QuestionVersionLineage.create(current, previous)).toThrow(
      /same question/i,
    );
  });

  it('rejects a predecessor with a skipped version number', () => {
    const questionId = QuestionId.generate();
    const current = createReference(questionId, 3);
    const previous = createReference(questionId, 1);

    expect(() => QuestionVersionLineage.create(current, previous)).toThrow(
      /immediately preceding version number/i,
    );
  });

  it('rejects a predecessor with a later version number', () => {
    const questionId = QuestionId.generate();
    const current = createReference(questionId, 2);
    const previous = createReference(questionId, 3);

    expect(() => QuestionVersionLineage.create(current, previous)).toThrow(
      /immediately preceding version number/i,
    );
  });

  it('rejects a version as its own predecessor', () => {
    const questionId = QuestionId.generate();
    const id = QuestionVersionId.generate();
    const current = createReference(questionId, 2, id);
    const previous = createReference(questionId, 1, id);

    expect(() => QuestionVersionLineage.create(current, previous)).toThrow(
      /own predecessor/i,
    );
  });

  it('rejects a restoration source owned by another question', () => {
    const questionId = QuestionId.generate();
    const current = createReference(questionId, 3);
    const previous = createReference(questionId, 2);
    const source = createReference(QuestionId.generate(), 1);

    expect(() =>
      QuestionVersionLineage.create(current, previous, source),
    ).toThrow(/same question/i);
  });

  it('rejects a restoration source with the same version number as the current version', () => {
    const questionId = QuestionId.generate();
    const current = createReference(questionId, 3);
    const previous = createReference(questionId, 2);
    const source = createReference(questionId, 3);

    expect(() =>
      QuestionVersionLineage.create(current, previous, source),
    ).toThrow(/earlier question version/i);
  });

  it('rejects a restoration source with a later version number', () => {
    const questionId = QuestionId.generate();
    const current = createReference(questionId, 3);
    const previous = createReference(questionId, 2);
    const source = createReference(questionId, 4);

    expect(() =>
      QuestionVersionLineage.create(current, previous, source),
    ).toThrow(/earlier question version/i);
  });

  it('rejects a version as its own restoration source', () => {
    const questionId = QuestionId.generate();
    const id = QuestionVersionId.generate();
    const current = createReference(questionId, 3, id);
    const previous = createReference(questionId, 2);
    const source = createReference(questionId, 1, id);

    expect(() =>
      QuestionVersionLineage.create(current, previous, source),
    ).toThrow(/restored from itself/i);
  });

  it('rejects inconsistent metadata for the same predecessor and restoration source ID', () => {
    const questionId = QuestionId.generate();
    const current = createReference(questionId, 3);
    const sharedId = QuestionVersionId.generate();
    const previous = createReference(questionId, 2, sharedId);
    const inconsistentSource = createReference(questionId, 1, sharedId);

    expect(() =>
      QuestionVersionLineage.create(current, previous, inconsistentSource),
    ).toThrow(/consistent identity and ownership metadata/i);
  });

  it('does not reject a restoration source merely because it is not the immediate predecessor', () => {
    const questionId = QuestionId.generate();
    const historicalSource = createReference(questionId, 1);
    const immediatePredecessor = createReference(questionId, 3);
    const current = createReference(questionId, 4);

    expect(() =>
      QuestionVersionLineage.create(
        current,
        immediatePredecessor,
        historicalSource,
      ),
    ).not.toThrow();
  });

  it('is immutable', () => {
    const questionId = QuestionId.generate();
    const previous = createReference(questionId, 1);
    const current = createReference(questionId, 2);

    const lineage = QuestionVersionLineage.create(current, previous);

    expect(Object.isFrozen(lineage)).toBe(true);
  });

  it('does not mutate the supplied version references', () => {
    const questionId = QuestionId.generate();
    const previous = createReference(questionId, 1);
    const current = createReference(questionId, 2);

    QuestionVersionLineage.create(current, previous);

    expect(Object.isFrozen(current)).toBe(true);
    expect(Object.isFrozen(previous)).toBe(true);
  });
});

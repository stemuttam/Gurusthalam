import { QuestionVersionReference } from './question-version-reference.js';

/**
 * Immutable lineage metadata for one question version.
 *
 * The immediate predecessor and restoration source are separate relationships:
 *
 * - previousVersion is the immediately preceding version in the chronological
 *   revision chain.
 * - restoredFromVersion identifies the historical version whose content was
 *   used as the source for a restoration revision.
 *
 * This contract does not contain question content and is not a complete
 * QuestionVersion entity.
 */
export class QuestionVersionLineage {
  readonly currentVersion: QuestionVersionReference;
  readonly previousVersion: QuestionVersionReference | null;
  readonly restoredFromVersion: QuestionVersionReference | null;

  private constructor(
    currentVersion: QuestionVersionReference,
    previousVersion: QuestionVersionReference | null,
    restoredFromVersion: QuestionVersionReference | null,
  ) {
    this.currentVersion = currentVersion;
    this.previousVersion = previousVersion;
    this.restoredFromVersion = restoredFromVersion;

    Object.freeze(this);
  }

  static create(
    currentVersion: QuestionVersionReference,
    previousVersion?: QuestionVersionReference | null,
    restoredFromVersion?: QuestionVersionReference | null,
  ): QuestionVersionLineage {
    if (!(currentVersion instanceof QuestionVersionReference)) {
      throw new TypeError(
        'QuestionVersionLineage requires a valid current version reference.',
      );
    }

    // Distinguish omitted arguments from explicitly supplied undefined.
    if (arguments.length >= 2 && previousVersion === undefined) {
      throw new TypeError(
        'The previous version must be a QuestionVersionReference or null.',
      );
    }

    if (arguments.length >= 3 && restoredFromVersion === undefined) {
      throw new TypeError(
        'The restoration source must be a QuestionVersionReference or null.',
      );
    }

    const normalizedPreviousVersion = previousVersion ?? null;
    const normalizedRestoredFromVersion = restoredFromVersion ?? null;

    if (
      normalizedPreviousVersion !== null &&
      !(normalizedPreviousVersion instanceof QuestionVersionReference)
    ) {
      throw new TypeError(
        'The previous version must be a QuestionVersionReference or null.',
      );
    }

    if (
      normalizedRestoredFromVersion !== null &&
      !(normalizedRestoredFromVersion instanceof QuestionVersionReference)
    ) {
      throw new TypeError(
        'The restoration source must be a QuestionVersionReference or null.',
      );
    }

    QuestionVersionLineage.assertPredecessor(
      currentVersion,
      normalizedPreviousVersion,
    );

    QuestionVersionLineage.assertRestorationSource(
      currentVersion,
      normalizedRestoredFromVersion,
    );

    QuestionVersionLineage.assertConsistentSharedReference(
      normalizedPreviousVersion,
      normalizedRestoredFromVersion,
    );

    return new QuestionVersionLineage(
      currentVersion,
      normalizedPreviousVersion,
      normalizedRestoredFromVersion,
    );
  }

  get isInitialVersion(): boolean {
    return this.currentVersion.versionNumber.value === 1;
  }

  get isRestoration(): boolean {
    return this.restoredFromVersion !== null;
  }

  private static assertPredecessor(
    currentVersion: QuestionVersionReference,
    previousVersion: QuestionVersionReference | null,
  ): void {
    const currentNumber = currentVersion.versionNumber.value;

    if (currentNumber === 1) {
      if (previousVersion !== null) {
        throw new TypeError(
          'The initial question version must not have a predecessor.',
        );
      }

      return;
    }

    if (previousVersion === null) {
      throw new TypeError(
        'Every question version after version 1 must have an immediate predecessor.',
      );
    }

    if (!previousVersion.questionId.equals(currentVersion.questionId)) {
      throw new TypeError(
        'A question version predecessor must belong to the same question.',
      );
    }

    if (previousVersion.id.equals(currentVersion.id)) {
      throw new TypeError('A question version cannot be its own predecessor.');
    }

    if (previousVersion.versionNumber.value !== currentNumber - 1) {
      throw new TypeError(
        'The predecessor must have the immediately preceding version number.',
      );
    }
  }

  private static assertRestorationSource(
    currentVersion: QuestionVersionReference,
    restoredFromVersion: QuestionVersionReference | null,
  ): void {
    if (restoredFromVersion === null) {
      return;
    }

    if (!restoredFromVersion.questionId.equals(currentVersion.questionId)) {
      throw new TypeError(
        'A restoration source must belong to the same question.',
      );
    }

    if (restoredFromVersion.id.equals(currentVersion.id)) {
      throw new TypeError('A question version cannot be restored from itself.');
    }

    if (
      restoredFromVersion.versionNumber.value >=
      currentVersion.versionNumber.value
    ) {
      throw new TypeError(
        'A restoration source must be an earlier question version.',
      );
    }
  }

  private static assertConsistentSharedReference(
    previousVersion: QuestionVersionReference | null,
    restoredFromVersion: QuestionVersionReference | null,
  ): void {
    if (previousVersion === null || restoredFromVersion === null) {
      return;
    }

    if (!previousVersion.questionId.equals(restoredFromVersion.questionId)) {
      return;
    }

    if (
      previousVersion.versionNumber.equals(restoredFromVersion.versionNumber) &&
      !previousVersion.id.equals(restoredFromVersion.id)
    ) {
      throw new TypeError(
        'A question cannot have different versions with the same version number.',
      );
    }

    if (
      previousVersion.id.equals(restoredFromVersion.id) &&
      !previousVersion.equals(restoredFromVersion)
    ) {
      throw new TypeError(
        'References to the same question version must have consistent identity and ownership metadata.',
      );
    }
  }
}

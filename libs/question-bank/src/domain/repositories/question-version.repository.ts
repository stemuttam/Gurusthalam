import type { QuestionId } from '../identifiers/question-id.js';
import type { QuestionVersionId } from '../identifiers/question-version-id.js';
import type { QuestionVersionNumber } from '../identifiers/question-version-number.js';
import type { QuestionVersionSnapshot } from '../versioning/question-version-snapshot.js';

/**
 * Persistence boundary for immutable QuestionVersion snapshots.
 *
 * A QuestionVersion is append-only. Implementations must reject attempts
 * to add an identifier or question/version-number combination that
 * already exists. They must never update an existing snapshot.
 */
export interface QuestionVersionRepository {
  findById(id: QuestionVersionId): Promise<QuestionVersionSnapshot | null>;

  findAllByQuestionId(
    questionId: QuestionId,
  ): Promise<readonly QuestionVersionSnapshot[]>;

  findLatestByQuestionId(
    questionId: QuestionId,
  ): Promise<QuestionVersionSnapshot | null>;

  existsByQuestionIdAndVersion(
    questionId: QuestionId,
    versionNumber: QuestionVersionNumber,
  ): Promise<boolean>;

  /**
   * Adds one complete immutable snapshot.
   *
   * The implementation must persist the Question, version, content,
   * answer key, and all type-specific rows atomically.
   */
  add(snapshot: QuestionVersionSnapshot): Promise<void>;
}
